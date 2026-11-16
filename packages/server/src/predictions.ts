import {
	bestOdds,
	blendProbabilities,
	blendReason,
	buildMatchFeatures,
	confidenceLevel,
	consensusFairProbabilities,
	dataWarnings,
	DEFAULT_ELO_POISSON_PARAMS,
	DEFAULT_RECOMMENDATION_RULES,
	ELO_POISSON_VERSION,
	eloPoissonPrediction,
	evaluateMarket,
	pickRecommendation,
	type PlayedMatch,
	type RecommendationRules
} from '@football/core';
import type { SqlExecutor, StoredTask } from '@football/db';
import type { TaskHandler } from './ingestWorker';

/**
 * Predikció-pipeline (ROADMAP 5.2, architecture.md §7.2 `derive`): az odds-snapshot után a feladat meccseire `elo-poisson`
 * predikció (core, változatlan modell) + piaci kombinálás + §5 szűrők → `model_version` (upsert), egy `prediction_run`
 * futásonként és kimenetenként egy `prediction` sor (append-only; a futás és a sorai egy utasításban). Pont-idejű: a történet
 * csak a `now` előtt kezdett, befejezett meccsek; a tabella a `standing_derived` utolsó `as_of`-ja a meccsnap UTC-éjfelénél.
 * Minden sor `features` mezője a teljes feature-snapshot (modell-bemenet, meccs-feature-ök, tabella, odds-snapshot).
 * TODO(polish): a feature-snapshot kimenetenként ismétlődik (külön tábla); `odds_best` (minden iroda) helyett a tárolt quote-ok.
 */

const FINISHED = ['FT', 'AET', 'PEN'];
const UPCOMING = ['NS', 'TBD'];
const DAY = 86_400_000;
const MAX_ODD = 9999.999; // numeric(7, 3)

/** A pipeline piacai: API-Football piac-id, kimenetek (a modell sorrendjében), vonal. */
const MARKETS = [
	{ id: 1, code: 'h2h', selections: ['Home', 'Draw', 'Away'], line: null },
	{ id: 5, code: 'ou25', selections: ['Over', 'Under'], line: 2.5 }
] as const;

export interface PredictionRunOptions {
	now: Date;
	trigger?: 'schedule' | 'manual' | 'backtest';
	rules?: RecommendationRules;
	/** A kiírt ajánlás tétje egységben. */
	stakeUnits?: number;
}

export interface PredictionRunResult {
	runId: number | null;
	predictions: number;
	recommendations: number;
}

/** A `prediction` sor bemenete (a `jsonb_to_recordset` oszlopnevei). */
export interface PredictionRow {
	fixture_id: number;
	market_id: number;
	selection: string;
	line: number | null;
	p_model: number;
	p_market_fair: number;
	odds_snapshot_id: number;
	best_odd: number;
	best_bookmaker_id: number;
	min_acceptable_odd: number;
	ev: number;
	is_recommendation: boolean;
	stake_units: number | null;
	confidence: string;
	features: unknown;
	explanation: string[];
	warnings: string[];
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

/** A modellverzió sora (paraméterekkel); meglévő id-t nem ír felül. */
export async function ensureModelVersion(db: SqlExecutor, rules: RecommendationRules): Promise<string> {
	await db.query(
		`INSERT INTO model_version (id, description, params, status) VALUES ($1, $2, $3::jsonb, 'dev') ON CONFLICT (id) DO NOTHING`,
		[
			ELO_POISSON_VERSION,
			'Elo + Poisson (Dixon–Coles), piaccal kombinálva (strategy.md §4.4–§5)',
			JSON.stringify({ model: DEFAULT_ELO_POISSON_PARAMS, rules })
		]
	);
	return ELO_POISSON_VERSION;
}

interface Target {
	id: number;
	league: number;
	season: number;
	kickoff: string;
	homeTeamId: number;
	awayTeamId: number;
}

interface OddsAt {
	snapshotId: number;
	capturedAt: string;
	/** Piac-id → iroda-id → kimenet-sorrendű oddsok. */
	byMarket: Map<number, Map<number, number[]>>;
}

/** A meccs legutóbbi (`captured_at ≤ now`) snapshotja a pipeline piacain, irodánként. `null`, ha nincs. */
async function latestOdds(db: SqlExecutor, fixtureId: number, now: Date): Promise<OddsAt | null> {
	const { rows } = await db.query<{
		sid: number;
		at: unknown;
		m: number;
		b: number;
		s: string;
		line: number | null;
		odd: number;
	}>(
		`WITH s AS (SELECT id, captured_at FROM odds_snapshot WHERE fixture_id = $1::bigint AND captured_at <= $2::timestamptz
			ORDER BY captured_at DESC, id DESC LIMIT 1)
		 SELECT s.id::float8 AS sid, s.captured_at AS at, q.market_id::float8 AS m, q.bookmaker_id::float8 AS b, q.selection AS s,
			q.line::float8 AS line, q.odd::float8 AS odd
		 FROM s LEFT JOIN odds_quote q ON q.snapshot_id = s.id`,
		[fixtureId, now.toISOString()]
	);
	if (!rows.length) return null;
	const byMarket = new Map<number, Map<number, number[]>>();
	for (const r of rows) {
		const market = MARKETS.find((m) => m.id === r.m && (m.line === null ? r.line === null : r.line === m.line));
		const k = market ? (market.selections as readonly string[]).indexOf(r.s) : -1;
		if (!market || k < 0) continue;
		const books = byMarket.get(market.id) ?? byMarket.set(market.id, new Map()).get(market.id)!;
		const odds =
			books.get(r.b) ??
			books
				.set(
					r.b,
					market.selections.map(() => NaN)
				)
				.get(r.b)!;
		odds[k] = r.odd;
	}
	return { snapshotId: rows[0].sid, capturedAt: new Date(rows[0].at as string).toISOString(), byMarket };
}

/** A pont-idejű tabella a `standing_derived`-ből: a meccsnap UTC-éjfelénél ≤ utolsó `as_of`. */
async function standingAt(db: SqlExecutor, t: Target) {
	const midnight = new Date(Math.floor(Date.parse(t.kickoff) / DAY) * DAY).toISOString();
	const { rows } = await db.query<{ as_of: unknown; team_id: number; rank: number; points: number; played: number }>(
		`SELECT as_of, team_id::float8 AS team_id, rank, points, played FROM standing_derived
		 WHERE league_id = $1::bigint AND season = $2::int AND as_of = (SELECT max(as_of) FROM standing_derived
			WHERE league_id = $1::bigint AND season = $2::int AND as_of <= $3::timestamptz)`,
		[t.league, t.season, midnight]
	);
	if (!rows.length) return null;
	const team = (id: number) => {
		const r = rows.find((x) => x.team_id === id);
		return r ? { rank: r.rank, points: r.points, played: r.played } : null;
	};
	return {
		asOf: new Date(rows[0].as_of as string).toISOString(),
		teams: rows.length,
		home: team(t.homeTeamId),
		away: team(t.awayTeamId)
	};
}

/** Befejezett meccsek a `now` előtt (minden liga), ligával és szezonnal. */
async function loadHistory(db: SqlExecutor, now: Date) {
	const { rows } = await db.query<{ id: number; k: unknown; h: number; a: number; gh: number; ga: number; l: number; s: number }>(
		`SELECT id::float8 AS id, kickoff_at AS k, home_team_id::float8 AS h, away_team_id::float8 AS a, goals_home AS gh,
			goals_away AS ga, league_id::float8 AS l, season AS s
		 FROM fixture WHERE status = ANY($1::text[]) AND goals_home IS NOT NULL AND goals_away IS NOT NULL
			AND kickoff_at < $2::timestamptz ORDER BY kickoff_at, id`,
		[FINISHED, now.toISOString()]
	);
	return rows.map((r) => ({
		league: r.l,
		season: r.s,
		match: {
			id: r.id,
			kickoff: new Date(r.k as string).toISOString(),
			homeTeamId: r.h,
			awayTeamId: r.a,
			homeGoals: r.gh,
			awayGoals: r.ga
		} satisfies PlayedMatch
	}));
}

/**
 * Egy predikciós futás a megadott meccsekre: csak a még el nem kezdett (`NS`/`TBD`, kezdés > `now`) és a pipeline piacain
 * teljes oddssorral rendelkező meccsek. Nincs predikció → nincs `prediction_run` sem.
 */
export async function runPredictions(
	db: SqlExecutor,
	fixtureIds: readonly number[],
	opts: PredictionRunOptions
): Promise<PredictionRunResult> {
	const rules = opts.rules ?? DEFAULT_RECOMMENDATION_RULES;
	const empty = { runId: null, predictions: 0, recommendations: 0 };
	if (!fixtureIds.length) return empty;
	const { rows: targetRows } = await db.query<{ id: number; l: number; s: number; k: unknown; h: number; a: number }>(
		`SELECT id::float8 AS id, league_id::float8 AS l, season AS s, kickoff_at AS k, home_team_id::float8 AS h,
			away_team_id::float8 AS a
		 FROM fixture WHERE id = ANY($1::bigint[]) AND status = ANY($2::text[]) AND kickoff_at > $3::timestamptz ORDER BY kickoff_at, id`,
		[fixtureIds, UPCOMING, opts.now.toISOString()]
	);
	if (!targetRows.length) return empty;
	const history = await loadHistory(db, opts.now);
	const allMatches = history.map((h) => h.match);
	const out: PredictionRow[] = [];

	for (const r of targetRows) {
		const t: Target = {
			id: r.id,
			league: r.l,
			season: r.s,
			kickoff: new Date(r.k as string).toISOString(),
			homeTeamId: r.h,
			awayTeamId: r.a
		};
		const odds = await latestOdds(db, t.id, opts.now);
		if (!odds) continue;
		const leagueMatches = history.filter((h) => h.league === t.league).map((h) => h.match);
		const seasonMatches = history.filter((h) => h.league === t.league && h.season === t.season).map((h) => h.match);
		const pred = eloPoissonPrediction(t, { history: allMatches, leagueMatches });
		const match = buildMatchFeatures(t, { seasonMatches, history: allMatches });
		const standing = await standingAt(db, t);
		const played = (side: 'home' | 'away') => standing?.[side]?.played ?? match[side].table?.played ?? 0;
		const oddsAgeMs = opts.now.getTime() - Date.parse(odds.capturedAt);
		const warnings = dataWarnings({
			oddsAgeMs,
			homeMatches: played('home'),
			awayMatches: played('away'),
			h2hMatches: match.h2h.matches
		});
		const blocked = warnings.some((w) => w.blocking);
		const pr = pred.probabilities;
		const pModelBy: Record<number, number[]> = { 1: [pr.home, pr.draw, pr.away], 5: [pr.over25, pr.under25] };

		const markets = MARKETS.flatMap((m) => {
			const books = [...(odds.byMarket.get(m.id) ?? new Map<number, number[]>())].filter(([, o]) =>
				o.every((x) => Number.isFinite(x) && x > 1)
			);
			if (!books.length) return [];
			const pModel = pModelBy[m.id];
			const e = evaluateMarket(
				pModel,
				books.map(([b, o]) => ({ bookmaker: String(b), odds: o })),
				rules,
				blocked
			);
			return e ? [{ m, books, pModel, e }] : [];
		});
		const pick = pickRecommendation(markets.map((x) => ({ ...x.e, marketId: x.m.id })));
		const seasonMin = Math.min(played('home'), played('away'));

		for (const { m, books, pModel, e } of markets) {
			const pMarket = consensusFairProbabilities(books.map(([, o]) => o));
			const pFinal = blendProbabilities(pModel, pMarket, rules.blendWeight);
			const best = bestOdds(books.map(([, o]) => o));
			const features = {
				model: pred.inputs,
				pModelRaw: pModel,
				pMarketFair: pMarket,
				pFinal,
				match,
				standing,
				odds: { snapshotId: odds.snapshotId, capturedAt: odds.capturedAt, bookmakers: books.length },
				rejections: e.rejections
			};
			m.selections.forEach((selection, i) => {
				const isRec = pick?.marketId === m.id && pick.outcomeIndex === i;
				const edge = pFinal[i] - pMarket[i];
				out.push({
					fixture_id: t.id,
					market_id: m.id,
					selection,
					line: m.line,
					p_model: pFinal[i],
					p_market_fair: pMarket[i],
					odds_snapshot_id: odds.snapshotId,
					best_odd: best[i].odds,
					best_bookmaker_id: books[best[i].bookmakerIndex][0],
					min_acceptable_odd: Math.min(MAX_ODD, round3((1 + rules.evThreshold) / pFinal[i])),
					ev: pFinal[i] * best[i].odds - 1,
					is_recommendation: isRec,
					stake_units: isRec ? opts.stakeUnits ?? 1 : null,
					confidence: confidenceLevel({ edge, seasonMatches: seasonMin, oddsAgeMs }),
					features,
					explanation: [...pred.explanation.map((f) => f.text), blendReason(pModel[i], pFinal[i], rules.blendWeight)],
					warnings: warnings.map((w) => w.text)
				});
			});
		}
	}
	if (!out.length) return empty;

	const modelVersion = await ensureModelVersion(db, rules);
	// A futás és a sorai egy utasításban: részleges futás nem marad.
	const { rows } = await db.query<{ run_id: number }>(
		`WITH r AS (INSERT INTO prediction_run (model_version, trigger, as_of) VALUES ($1, $2, $3::timestamptz) RETURNING id)
		 INSERT INTO prediction (run_id, fixture_id, market_id, selection, line, p_model, p_market_fair, odds_snapshot_id, best_odd,
			best_bookmaker_id, min_acceptable_odd, ev, is_recommendation, stake_units, confidence, features, explanation, warnings)
		 SELECT r.id, x.fixture_id, x.market_id, x.selection, x.line, x.p_model, x.p_market_fair, x.odds_snapshot_id, x.best_odd,
			CASE WHEN EXISTS (SELECT 1 FROM bookmaker WHERE id = x.best_bookmaker_id) THEN x.best_bookmaker_id END,
			x.min_acceptable_odd, x.ev, x.is_recommendation, x.stake_units, x.confidence, x.features, x.explanation, x.warnings
		 FROM r, jsonb_to_recordset($4::jsonb) AS x (fixture_id bigint, market_id bigint, selection text, line numeric,
			p_model float8, p_market_fair float8, odds_snapshot_id bigint, best_odd numeric, best_bookmaker_id bigint,
			min_acceptable_odd numeric, ev float8, is_recommendation boolean, stake_units numeric, confidence text, features jsonb,
			explanation jsonb, warnings jsonb)
		 RETURNING run_id::float8 AS run_id`,
		[modelVersion, opts.trigger ?? 'schedule', opts.now.toISOString(), JSON.stringify(out)]
	);
	return {
		runId: rows[0]?.run_id ?? null,
		predictions: rows.length,
		recommendations: out.filter((p) => p.is_recommendation).length
	};
}

/** A `derive` lépés: az odds-handler után a feladat meccseire predikciós futás (0 API-hívás). */
export function withPredictions(db: SqlExecutor, handler: TaskHandler): TaskHandler {
	return async (task: StoredTask, ctx) => {
		const res = await handler(task, ctx);
		const ids = Array.isArray(task.params.fixtures) ? task.params.fixtures.map(Number).filter((id) => id > 0) : [];
		await runPredictions(db, ids, { now: ctx.now, trigger: 'schedule' });
		return res;
	};
}
