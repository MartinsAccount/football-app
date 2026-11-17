import {
	consensusFairProbabilities,
	dixonColesPredict,
	DRAW_MODEL_FITTED,
	drawFeaturesAt,
	fairProbabilities,
	fitDixonColes,
	rankDraws,
	type DixonColesWalkForwardOptions,
	type DrawModelInput,
	type DrawWatchTarget,
	type PlayedMatch
} from '@football/core';
import type { SqlExecutor } from '@football/db';
import type { DrawsQuery, DrawsResponse, DrawWatchItemDto } from '@football/contract';

/**
 * Döntetlen-figyelő (D2, ROADMAP 12.7, docs/plans/owner-style-and-draws.md): a [from, to) ablak meccsei a rögzített
 * `draw-logreg` modell (core `DRAW_MODEL_FITTED`, futás közben nincs logreg-illesztés) p(X)-e szerint, top 3 tényezővel.
 * Rangsor + magyarázat, NEM értéktipp. Pont-idejű: Elo és döntetlen-történet a meccs kezdése előtti befejezett meccsekből; a
 * Dixon–Coles gólmodell egyszer illeszt kérésenként az ablak elejére (`from`). 0 külső hívás.
 */

const FINISHED = ['FT', 'AET', 'PEN'];
const SKIPPED = ['PST', 'CANC', 'ABD', 'AWD', 'WO'];
const DAY = 86_400_000;
export const DRAWS_DEFAULT_DAYS = 3;
export const DRAWS_DEFAULT_LIMIT = 10;
export const DRAWS_MAX_LIMIT = 50;
/** A CSV-átlag pszeudo-iroda (a modell ezen a nyitó oddson tanult) és a CSV-maximum (nem valódi iroda). */
const CSV_AVG = 900001;
const CSV_MAX = 900002;
/** Az I26/D1-ben választott Dixon–Coles hiperparaméterek (DECISIONS.md, 2026-11-16). */
const DC: DixonColesWalkForwardOptions = { windowDays: 730, xi: 0.002, ridge: 4 };

export class DrawsValidationError extends Error {}

/** `?from&to&limit` → ellenőrzött ablak; alap: `now` → +3 nap, 10 elem. */
export function parseDrawsQuery(q: URLSearchParams, now: Date): Required<DrawsQuery> {
	const date = (name: string) => {
		const raw = q.get(name);
		if (raw === null || raw === '') return undefined;
		const ms = Date.parse(raw);
		if (Number.isNaN(ms)) throw new DrawsValidationError(`'${name}' nem értelmezhető dátum`);
		return new Date(ms).toISOString();
	};
	const from = date('from') ?? now.toISOString();
	const to = date('to') ?? new Date(Date.parse(from) + DRAWS_DEFAULT_DAYS * DAY).toISOString();
	if (Date.parse(to) <= Date.parse(from)) throw new DrawsValidationError("a 'to' legyen későbbi a 'from'-nál");
	if (Date.parse(to) - Date.parse(from) > 31 * DAY) throw new DrawsValidationError('az ablak legfeljebb 31 nap');
	const rawLimit = q.get('limit');
	if (rawLimit !== null && !/^\d+$/.test(rawLimit)) throw new DrawsValidationError("a 'limit' pozitív egész legyen");
	const limit = rawLimit === null ? DRAWS_DEFAULT_LIMIT : Number(rawLimit);
	if (limit < 1 || limit > DRAWS_MAX_LIMIT) throw new DrawsValidationError(`a 'limit' 1 és ${DRAWS_MAX_LIMIT} között legyen`);
	return { from, to, limit };
}

type Head = { id: number; l: number; ln: string; k: unknown; h: number; hn: string; a: number; an: string };
const iso = (k: unknown) => new Date(k as string).toISOString();

/**
 * Kezdés előtti 1X2-odds meccsenként: a nyitó CSV-snapshot (`opening_csv`), ennek hiányában a legutolsó kezdés előtti.
 * p(X): a CSV-átlag fair értéke, ha van (ezen tanult a modell), különben az irodák konszenzusa; X-odds: a snapshot maximuma.
 */
async function drawOdds(db: SqlExecutor, heads: Head[]): Promise<Map<number, { pMarket: number; drawOdds: number | null }>> {
	const { rows } = await db.query<{ fx: number; b: number; s: string; odd: number }>(
		`WITH snap AS (
			SELECT DISTINCT ON (t.fid) t.fid, s.id AS sid
			FROM unnest($1::bigint[], $2::timestamptz[]) AS t(fid, k) JOIN odds_snapshot s ON s.fixture_id = t.fid
			WHERE (s.kind = 'opening_csv' OR s.captured_at <= t.k)
				AND EXISTS (SELECT 1 FROM odds_quote q WHERE q.snapshot_id = s.id AND q.market_id = 1 AND q.line IS NULL)
			ORDER BY t.fid, (s.kind = 'opening_csv') DESC, s.captured_at DESC, s.id DESC)
		 SELECT snap.fid::float8 AS fx, q.bookmaker_id::float8 AS b, q.selection AS s, q.odd::float8 AS odd
		 FROM snap JOIN odds_quote q ON q.snapshot_id = snap.sid WHERE q.market_id = 1 AND q.line IS NULL`,
		[heads.map((h) => h.id), heads.map((h) => iso(h.k))]
	);
	const books = new Map<number, Map<number, Record<string, number>>>();
	for (const r of rows) {
		const byBook = books.get(r.fx) ?? books.set(r.fx, new Map()).get(r.fx)!;
		(byBook.get(r.b) ?? byBook.set(r.b, {}).get(r.b)!)[r.s] = r.odd;
	}
	const out = new Map<number, { pMarket: number; drawOdds: number | null }>();
	for (const [fx, byBook] of books) {
		const full = [...byBook]
			.map(([b, o]) => [b, [o.Home, o.Draw, o.Away]] as const)
			.filter(([, o]) => o.every((x) => Number.isFinite(x) && x > 1));
		if (!full.length) continue;
		const avg = full.find(([b]) => b === CSV_AVG);
		const real = full.filter(([b]) => b !== CSV_MAX);
		const pMarket = avg
			? fairProbabilities(avg[1])[1]
			: consensusFairProbabilities((real.length ? real : full).map(([, o]) => o))[1];
		out.set(fx, { pMarket, drawOdds: Math.max(...full.map(([, o]) => o[1])) });
	}
	return out;
}

export async function loadDrawWatch(db: SqlExecutor, query: Required<DrawsQuery>): Promise<DrawsResponse> {
	const { from, to, limit } = query;
	const empty: DrawsResponse = { modelVersion: DRAW_MODEL_FITTED.version, from, to, analyzed: 0, items: [] };
	const { rows: heads } = await db.query<Head>(
		`SELECT f.id::float8 AS id, f.league_id::float8 AS l, lg.name AS ln, f.kickoff_at AS k, f.home_team_id::float8 AS h,
			ht.name AS hn, f.away_team_id::float8 AS a, at.name AS an
		 FROM fixture f JOIN league lg ON lg.id = f.league_id JOIN team ht ON ht.id = f.home_team_id JOIN team at ON at.id = f.away_team_id
		 WHERE f.kickoff_at >= $1::timestamptz AND f.kickoff_at < $2::timestamptz AND NOT (f.status = ANY($3::text[]))
		 ORDER BY f.kickoff_at, f.id`,
		[from, to, SKIPPED]
	);
	if (!heads.length) return empty;
	const odds = await drawOdds(db, heads);
	const withOdds = heads.filter((h) => odds.has(h.id));
	if (!withOdds.length) return empty;

	// Lejátszott meccsek a legkésőbbi kezdésig: Elo + döntetlen-történet (teljes múlt), gólmodell (2 éves ablak).
	const lastKickoff = withOdds.reduce((m, h) => Math.max(m, Date.parse(iso(h.k))), 0);
	const { rows: playedRows } = await db.query<{
		id: number;
		l: number;
		k: unknown;
		h: number;
		a: number;
		gh: number;
		ga: number;
	}>(
		`SELECT id::float8 AS id, league_id::float8 AS l, kickoff_at AS k, home_team_id::float8 AS h, away_team_id::float8 AS a,
			goals_home AS gh, goals_away AS ga
		 FROM fixture WHERE status = ANY($1::text[]) AND goals_home IS NOT NULL AND goals_away IS NOT NULL
			AND kickoff_at < $2::timestamptz`,
		[FINISHED, new Date(lastKickoff).toISOString()]
	);
	const played: (PlayedMatch & { league: string })[] = playedRows.map((r) => ({
		id: r.id,
		league: String(r.l),
		kickoff: iso(r.k),
		homeTeamId: r.h,
		awayTeamId: r.a,
		homeGoals: r.gh,
		awayGoals: r.ga
	}));
	if (!played.some((m) => m.kickoff < from)) return empty; // nincs mire illeszteni a gólmodellt
	// TODO(polish): a DC-illesztés kérésenként fut (~másodperc); napi cache vagy a predikció-pipeline-ban tárolt paraméterek.
	const fit = fitDixonColes(played, { ...DC, asOf: from });
	const dcInputs = new Map<number, DrawModelInput>(
		withOdds.map((h) => {
			const p = dixonColesPredict(fit.params, h.h, h.a, String(h.l));
			return [h.id, { pDraw: p.probabilities.draw, lambdaHome: p.lambdaHome, lambdaAway: p.lambdaAway }];
		})
	);
	const targets: DrawWatchTarget[] = withOdds.map((h) => ({
		id: h.id,
		kickoff: iso(h.k),
		homeTeamId: h.h,
		awayTeamId: h.a,
		league: String(h.l),
		pMarket: odds.get(h.id)!.pMarket
	}));
	const features = drawFeaturesAt(played, targets, dcInputs);
	const byId = new Map(withOdds.map((h) => [h.id, h]));
	const items: DrawWatchItemDto[] = rankDraws(DRAW_MODEL_FITTED, features, { limit, topFactors: 3 }).map((r) => {
		const h = byId.get(r.id)!;
		return {
			fixtureId: h.id,
			league: { id: h.l, name: h.ln },
			kickoff: iso(h.k),
			home: { id: h.h, name: h.hn },
			away: { id: h.a, name: h.an },
			pDraw: r.pDraw,
			pMarket: r.pMarket,
			drawOdds: odds.get(h.id)!.drawOdds,
			factors: r.factors
		};
	});
	return { ...empty, analyzed: features.size, items };
}
