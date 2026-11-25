import type { QuizAnswer } from '@football/core';
import type { SqlExecutor } from './migrate';

/**
 * Kvízválaszok (ROADMAP 12.2, Q2): az `owner_answer` tábla (0008) írása és olvasása. Egy meccsre egy válasz; az újbóli
 * válasz felülírja (upsert). A tanítás sorrendje a válaszidő (a core keresztvalidációja index szerint hajtogat).
 */

export interface OwnerAnswerRecord extends QuizAnswer {
	/** ISO időpont. */
	answeredAt: string;
}

export interface OwnerAnswerRepository {
	upsert(answer: QuizAnswer, answeredAt?: string | null): Promise<OwnerAnswerRecord>;
	/** Minden válasz válaszidő szerint növekvő sorrendben. */
	list(): Promise<OwnerAnswerRecord[]>;
}

type Row = { fixtureId: number; pick: QuizAnswer['pick']; confidence: number | null; answeredAt: unknown };
const toRecord = (r: Row): OwnerAnswerRecord => ({
	fixtureId: r.fixtureId,
	pick: r.pick,
	...(r.confidence === null ? {} : { confidence: r.confidence as 1 | 2 | 3 }),
	answeredAt: new Date(r.answeredAt as string).toISOString()
});
const COLS = `fixture_id::float8 AS "fixtureId", pick, confidence::int AS confidence, answered_at AS "answeredAt"`;

export class SqlOwnerAnswerRepository implements OwnerAnswerRepository {
	constructor(private readonly db: SqlExecutor) {}

	async upsert(answer: QuizAnswer, answeredAt: string | null = null): Promise<OwnerAnswerRecord> {
		const { rows } = await this.db.query<Row>(
			`INSERT INTO owner_answer (fixture_id, pick, confidence, answered_at)
			 VALUES ($1, $2, $3, COALESCE($4::timestamptz, now()))
			 ON CONFLICT (fixture_id) DO UPDATE SET pick = EXCLUDED.pick, confidence = EXCLUDED.confidence,
				answered_at = EXCLUDED.answered_at
			 RETURNING ${COLS}`,
			[answer.fixtureId, answer.pick, answer.confidence ?? null, answeredAt]
		);
		return toRecord(rows[0]);
	}

	async list(): Promise<OwnerAnswerRecord[]> {
		const { rows } = await this.db.query<Row>(`SELECT ${COLS} FROM owner_answer ORDER BY answered_at, fixture_id`);
		return rows.map(toRecord);
	}
}
