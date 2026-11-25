import { formatDecimal, formatKickoff } from '../format/format';
import type { IngestTaskKind } from '../ingest/tasks';

/**
 * Budget-panel nézet-modellje (I19, ROADMAP 2.4) a `GET /api/budget` válaszából. Tiszta: csak formáz és egyeztet.
 * A bemenet a contract `BudgetResponse` szerkezete (a core nem függ a contracttól).
 */
export interface IBudgetInput {
	day: string;
	used: number;
	limit: number;
	reserve: number;
	syncedRemaining: number | null;
	remaining: number;
	jobs: readonly { job: string; live: number; mock: number }[];
	status: { checkedAt: string | null; remainingAtCheck: number | null };
	cron: { runs: number; calls: number; lastAt: string | null; lastStatus: string | null };
}

export type BudgetTone = 'ok' | 'warning' | 'danger';
export type ReconciliationState = 'none' | 'match' | 'drift';

export interface IBudgetJobRow {
	key: string;
	label: string;
	live: string;
	/** Mock hívások száma, ha volt (nem fogy a kvótából). */
	mock: string | null;
}

export interface IBudgetView {
	/** A fejléc-pill száma: `12/100 hívás`. */
	pill: string;
	/** 0–100: a napi keret felhasznált része. */
	usedPct: number;
	tone: BudgetTone;
	stats: { label: string; value: string }[];
	jobs: IBudgetJobRow[];
	reconciliation: { state: ReconciliationState; text: string };
	cron: string;
}

const JOB_LABELS: Record<IngestTaskKind | 'manual', string> = {
	odds_late: 'Késői odds',
	odds_early: 'Korai odds',
	injuries: 'Sérültek',
	results: 'Eredmények',
	standings: 'Tabella',
	fixtures_window: 'Meccsnaptár',
	reference: 'Törzsadat',
	predictions_api: 'API-predikció',
	backfill: 'Visszatöltés',
	manual: 'Kézi / szkript'
};

export const budgetJobLabel = (job: string): string => (JOB_LABELS as Record<string, string>)[job] ?? job;

const count = (n: number): string => formatDecimal(n, 0);

/** A maradék a keret ≤ 10%-a → danger, ≤ 30%-a → warning. */
export const budgetTone = (remaining: number, limit: number): BudgetTone =>
	limit <= 0 || remaining <= limit * 0.1 ? 'danger' : remaining <= limit * 0.3 ? 'warning' : 'ok';

/**
 * Egyeztetés a `/status`-szal: a helyi számláló szerinti maradék (`limit − used`) vs. a `/status` óta foglalásonként
 * csökkentett `syncedRemaining`. Eltérés = a kulcsot más is használta (vagy fordítva: a szolgáltató kevesebbet számolt).
 */
export function reconcileBudget(b: IBudgetInput, now: Date = new Date()): IBudgetView['reconciliation'] {
	const at = b.status.checkedAt ? ` (${formatKickoff(new Date(b.status.checkedAt), now)})` : '';
	if (b.syncedRemaining === null) return { state: 'none', text: 'Ma még nincs mentett /status-adat – a helyi számláló szerint.' };
	const drift = b.limit - b.used - b.syncedRemaining;
	if (drift === 0) return { state: 'match', text: `Egyezik a /status-szal${at}.` };
	return drift > 0
		? { state: 'drift', text: `A /status szerint ${count(drift)} hívással kevesebb maradt${at} – a kulcsot más is használja.` }
		: { state: 'drift', text: `A /status szerint ${count(-drift)} hívással több maradt${at}.` };
}

export function budgetView(b: IBudgetInput, now: Date = new Date()): IBudgetView {
	const pct = b.limit > 0 ? Math.min(100, Math.max(0, Math.round((b.used / b.limit) * 100))) : 100;
	const cron = b.cron.runs
		? `${count(b.cron.runs)} ütemező-futás, ${count(b.cron.calls)} hívás${
				b.cron.lastAt ? ` · utolsó ${formatKickoff(new Date(b.cron.lastAt), now)}` : ''
		  }${b.cron.lastStatus && b.cron.lastStatus !== 'ok' ? ` (${b.cron.lastStatus})` : ''}`
		: 'Ma még nem futott az ütemező.';
	return {
		pill: `${count(b.used)}/${count(b.limit)} hívás`,
		usedPct: pct,
		tone: budgetTone(b.remaining, b.limit),
		stats: [
			{ label: 'Felhasznált', value: count(b.used) },
			{ label: 'Maradék', value: count(b.remaining) },
			{ label: 'Tartalék', value: count(b.reserve) }
		],
		jobs: b.jobs.map((j) => ({
			key: j.job,
			label: budgetJobLabel(j.job),
			live: count(j.live),
			mock: j.mock ? count(j.mock) : null
		})),
		reconciliation: reconcileBudget(b, now),
		cron
	};
}
