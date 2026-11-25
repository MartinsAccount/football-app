import {
	brierScore,
	closingLineValue,
	flatProfit,
	isVoidStatus,
	logLoss,
	marketResultIndex,
	settleSelection,
	type BetOutcome,
	type EvaluationRecord
} from '@football/core';
import type { SqlExecutor } from '@football/db';
import { PREDICTION_MARKETS } from './predictions';

/**
 * Kiértékelő job (ROADMAP 5.3, strategy.md §7.2): a `results` után a lezárt meccsek még ki nem értékelt `prediction` soraira
 * egy-egy `evaluation` sor (a core `evaluation/` képleteivel). Befejezett (FT/AET/PEN) meccs: a rendes játékidő eredménye
 * (`ft_*`, ennek hiányában `goals_*`); PST/CANC/ABD → void (profit 0, Brier/log-loss/CLV `null`). A Brier és a log-loss a
 * piac teljes eloszlására (egy futás × meccs × piac × vonal) számol, és a csoport minden sorára ugyanaz kerül; a nem kizáró
 * Double Chance-nél (Σp = 2) `null` (az 1X2 sorai lefedik ugyanazt az eloszlást). A profit flat
 * 1 egység a predikció `best_odd`-jára. CLV: a kezdés előtti utolsó snapshot tárolt quote-jainak maximuma (záró-közeli).
 * Idempotens: `ON CONFLICT (prediction_id) DO NOTHING` – a már kiértékelt sor nem változik.
 * TODO(polish): ázsiai vonalak (half_win/half_loss), a záró odds az `odds_best`-ből is.
 */

const FINISHED = ['FT', 'AET', 'PEN'];

export interface EvaluationOptions {
	/** Az elszámolás ideje (`settled_at`). */
	now: Date;
}

export interface EvaluationRow {
	prediction_id: number;
	outcome: BetOutcome;
	profit_units: number;
	brier: number | null;
	log_loss: number | null;
	closing_snapshot_id: number | null;
	closing_odd: number | null;
	clv: number | null;
}

export interface EvaluationCandidate {
	id: number;
	run: number;
	fx: number;
	m: number;
	sel: string;
	line: number | null;
	p: number;
	odd: number | null;
	status: string;
	gh: number | null;
	ga: number | null;
}

const lineKey = (line: number | null) => (line === null ? '' : String(line));

/** Tiszta: a jelölt sorokból és a záró odds-okból az `evaluation` sorok (a nem értékelhetők kimaradnak). */
export function buildEvaluationRows(
	candidates: readonly EvaluationCandidate[],
	closing: ReadonlyMap<string, { snapshotId: number; odd: number }>
): EvaluationRow[] {
	const groups = new Map<string, EvaluationCandidate[]>();
	for (const c of candidates) {
		const k = `${c.run}:${c.fx}:${c.m}:${lineKey(c.line)}`;
		(groups.get(k) ?? groups.set(k, []).get(k)!).push(c);
	}
	const out: EvaluationRow[] = [];
	for (const group of groups.values()) {
		const first = group[0];
		const selections = PREDICTION_MARKETS.find((m) => m.id === first.m)?.selections as readonly string[] | undefined;
		const voidMatch = isVoidStatus(first.status);
		if (!selections || (!voidMatch && (first.gh === null || first.ga === null))) continue;
		// Kizáró piacnál a nyerő index (Brier/log-loss); `null` = void/push, `undefined` = nem kizáró (DC) vagy nem értékelhető.
		const idx = voidMatch ? null : marketResultIndex(first.m, first.line, first.gh!, first.ga!);
		const bySel = new Map(group.map((c) => [c.sel, c]));
		const complete = selections.every((s) => bySel.has(s));
		const probs = selections.map((s) => bySel.get(s)?.p ?? NaN);
		const brier = complete && typeof idx === 'number' ? brierScore(probs, idx) : null;
		const ll = complete && typeof idx === 'number' ? logLoss(probs, idx) : null;
		for (const c of group) {
			const k = selections.indexOf(c.sel);
			if (k < 0 || c.odd === null || !(c.odd > 1)) continue;
			const outcome = voidMatch ? 'void' : settleSelection(c.m, c.line, k, c.gh!, c.ga!);
			if (!outcome) continue;
			const close =
				outcome === 'void' && isVoidStatus(c.status) ? undefined : closing.get(`${c.fx}:${c.m}:${c.sel}:${lineKey(c.line)}`);
			out.push({
				prediction_id: c.id,
				outcome,
				profit_units: flatProfit(outcome, c.odd),
				brier,
				log_loss: ll,
				closing_snapshot_id: close?.snapshotId ?? null,
				closing_odd: close?.odd ?? null,
				clv: closingLineValue(c.odd, close?.odd)
			});
		}
	}
	return out;
}

/**
 * A megadott meccsek még ki nem értékelt predikcióinak kiértékelése (csak lezárt vagy void meccs). A beszúrt sorok száma;
 * ismételt futás 0-t ad.
 */
export async function evaluateFixtures(db: SqlExecutor, fixtureIds: readonly number[], opts: EvaluationOptions): Promise<number> {
	if (!fixtureIds.length) return 0;
	const { rows } = await db.query<EvaluationCandidate>(
		`SELECT p.id::float8 AS id, p.run_id::float8 AS run, p.fixture_id::float8 AS fx, p.market_id::float8 AS m,
			p.selection AS sel, p.line::float8 AS line, p.p_model AS p, p.best_odd::float8 AS odd, f.status,
			COALESCE(f.ft_home, f.goals_home)::int AS gh, COALESCE(f.ft_away, f.goals_away)::int AS ga
		 FROM prediction p JOIN fixture f ON f.id = p.fixture_id
		 WHERE p.fixture_id = ANY($1::bigint[]) AND NOT EXISTS (SELECT 1 FROM evaluation e WHERE e.prediction_id = p.id)
			AND (f.status = ANY($2::text[]) OR f.status = ANY($3::text[]))
		 ORDER BY p.id`,
		[fixtureIds, FINISHED, ['PST', 'CANC', 'ABD']]
	);
	if (!rows.length) return 0;
	const { rows: close } = await db.query<{ fx: number; sid: number; m: number; sel: string; line: number | null; odd: number }>(
		`WITH cs AS (
			SELECT DISTINCT ON (s.fixture_id) s.id, s.fixture_id FROM odds_snapshot s JOIN fixture f ON f.id = s.fixture_id
			WHERE s.fixture_id = ANY($1::bigint[]) AND s.captured_at <= f.kickoff_at ORDER BY s.fixture_id, s.captured_at DESC)
		 SELECT cs.fixture_id::float8 AS fx, cs.id::float8 AS sid, q.market_id::float8 AS m, q.selection AS sel,
			q.line::float8 AS line, max(q.odd)::float8 AS odd
		 FROM cs JOIN odds_quote q ON q.snapshot_id = cs.id GROUP BY cs.fixture_id, cs.id, q.market_id, q.selection, q.line`,
		[[...new Set(rows.map((r) => r.fx))]]
	);
	const closing = new Map(close.map((r) => [`${r.fx}:${r.m}:${r.sel}:${lineKey(r.line)}`, { snapshotId: r.sid, odd: r.odd }]));
	const evals = buildEvaluationRows(rows, closing);
	if (!evals.length) return 0;
	const res = await db.query<{ prediction_id: number }>(
		`INSERT INTO evaluation (prediction_id, settled_at, outcome, profit_units, brier, log_loss, closing_snapshot_id, closing_odd, clv)
		 SELECT x.prediction_id, $1::timestamptz, x.outcome, x.profit_units, x.brier, x.log_loss, x.closing_snapshot_id,
			x.closing_odd, x.clv
		 FROM jsonb_to_recordset($2::jsonb) AS x (prediction_id bigint, outcome text, profit_units float8, brier float8,
			log_loss float8, closing_snapshot_id bigint, closing_odd numeric, clv float8)
		 ON CONFLICT (prediction_id) DO NOTHING
		 RETURNING prediction_id`,
		[opts.now.toISOString(), JSON.stringify(evals)]
	);
	return res.rows.length;
}

/** A dashboard (I17) bemenete: minden kiértékelt predikció a futás modellverziójával (0 külső hívás). */
export async function loadEvaluationRecords(db: SqlExecutor): Promise<EvaluationRecord[]> {
	const { rows } = await db.query<EvaluationRecord>(
		`SELECT p.run_id::float8 AS "runId", p.fixture_id::float8 AS "fixtureId", p.market_id::float8 AS "marketId",
			p.selection, p.line::float8 AS line, r.model_version AS "modelVersion", p.is_recommendation AS "isRecommendation",
			p.p_model AS "pModel", p.best_odd::float8 AS odd, e.outcome, e.brier, e.log_loss AS "logLoss",
			e.closing_odd::float8 AS "closingOdd"
		 FROM evaluation e JOIN prediction p ON p.id = e.prediction_id JOIN prediction_run r ON r.id = p.run_id
		 ORDER BY p.id`
	);
	return rows;
}
