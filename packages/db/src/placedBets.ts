import type { PlacedBetRecord } from '@football/core';
import type { SqlExecutor } from './migrate';

/**
 * Megtett fogadások (ROADMAP 5.6, I23): a `placed_bet` tábla (0004) írása és olvasása. Csak kézi rögzítés – bukmékerhez
 * leadás nincs (PRD 8). Az olvasás a meccs eredményét és a kapcsolt predikció modellverzióját, `best_odd`-ját és – ha a tipp
 * ugyanarra a kimenetre/vonalra szól – `evaluation` kimenetét is hozza, hogy a core `summarizeOwnBets` elszámolhassa.
 */

export interface PlacedBetInput {
	fixtureId: number;
	marketId: number;
	selection: string;
	line: number | null;
	oddTaken: number;
	stake: number;
	predictionId: number | null;
	bookmakerLabel: string | null;
	/** ISO időpont; hiányában `now()`. */
	placedAt: string | null;
	note: string | null;
}

/** Hiányzó vagy ellentmondó hivatkozás (meccs, piac, predikció) – a server 400-ra fordítja. */
export class PlacedBetRefError extends Error {}

export interface PlacedBetRepository {
	insert(input: PlacedBetInput): Promise<PlacedBetRecord>;
	list(): Promise<PlacedBetRecord[]>;
}

const SELECT = `SELECT b.id::float8 AS id, b.fixture_id::float8 AS "fixtureId", b.market_id::float8 AS "marketId", b.selection,
		b.line::float8 AS line, b.bookmaker_label AS "bookmakerLabel", b.odd_taken::float8 AS "oddTaken", b.stake::float8 AS stake,
		b.placed_at AS "placedAt", b.note, b.prediction_id::float8 AS "predictionId", r.model_version AS "modelVersion",
		p.best_odd::float8 AS "modelOdd", e.outcome AS "evaluationOutcome", e.closing_odd::float8 AS "closingOdd", f.status,
		COALESCE(f.ft_home, f.goals_home)::int AS "homeGoals", COALESCE(f.ft_away, f.goals_away)::int AS "awayGoals"
	FROM placed_bet b
	JOIN fixture f ON f.id = b.fixture_id
	LEFT JOIN prediction p ON p.id = b.prediction_id
	LEFT JOIN prediction_run r ON r.id = p.run_id
	LEFT JOIN evaluation e ON e.prediction_id = p.id AND p.market_id = b.market_id AND p.selection = b.selection
		AND p.line IS NOT DISTINCT FROM b.line`;

type Row = Omit<PlacedBetRecord, 'placedAt'> & { placedAt: unknown };
const toRecord = (r: Row): PlacedBetRecord => ({ ...r, placedAt: new Date(r.placedAt as string).toISOString() });

export class SqlPlacedBetRepository implements PlacedBetRepository {
	constructor(private readonly db: SqlExecutor) {}

	/** A hivatkozások ellenőrzése íráskor: üzenetek listája (üres = rendben). */
	async refIssues(input: Pick<PlacedBetInput, 'fixtureId' | 'marketId' | 'predictionId'>): Promise<string[]> {
		const { rows } = await this.db.query<{ fx: boolean; m: boolean; pfx: number | null }>(
			`SELECT EXISTS (SELECT 1 FROM fixture WHERE id = $1) AS fx, EXISTS (SELECT 1 FROM market WHERE id = $2) AS m,
				(SELECT fixture_id::float8 FROM prediction WHERE id = $3) AS pfx`,
			[input.fixtureId, input.marketId, input.predictionId]
		);
		const { fx, m, pfx } = rows[0];
		const issues: string[] = [];
		if (!fx) issues.push(`Nincs ilyen meccs: ${input.fixtureId}`);
		if (!m) issues.push(`Nincs ilyen piac: ${input.marketId}`);
		if (input.predictionId !== null) {
			if (pfx === null) issues.push(`Nincs ilyen predikció: ${input.predictionId}`);
			else if (pfx !== input.fixtureId) issues.push(`A ${input.predictionId}. predikció másik meccshez tartozik`);
		}
		return issues;
	}

	async insert(input: PlacedBetInput): Promise<PlacedBetRecord> {
		const issues = await this.refIssues(input);
		if (issues.length) throw new PlacedBetRefError(issues.join('; '));
		const { rows } = await this.db.query<{ id: number }>(
			`INSERT INTO placed_bet (prediction_id, fixture_id, market_id, selection, line, bookmaker_label, odd_taken, stake, placed_at, note)
			 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, now()), $10) RETURNING id::float8 AS id`,
			[
				input.predictionId,
				input.fixtureId,
				input.marketId,
				input.selection,
				input.line,
				input.bookmakerLabel,
				input.oddTaken,
				input.stake,
				input.placedAt,
				input.note
			]
		);
		const { rows: out } = await this.db.query<Row>(`${SELECT} WHERE b.id = $1`, [rows[0].id]);
		return toRecord(out[0]);
	}

	/** Minden rögzített fogadás, a legutóbbi elöl. */
	async list(): Promise<PlacedBetRecord[]> {
		const { rows } = await this.db.query<Row>(`${SELECT} ORDER BY b.placed_at DESC, b.id DESC`);
		return rows.map(toRecord);
	}
}
