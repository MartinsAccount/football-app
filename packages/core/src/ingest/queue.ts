// Feladatsor-szabályok a worker oldalán (architecture.md §7.1–§7.3): kiválasztás, határidő-lejárat, hibakezelés.
// Tiszta függvények; a tár (claim/lezárás SQL-lel) az I5-ben ezekre épül.

import type { IngestTaskKind, IngestTaskStatus } from './tasks';

export interface QueueTask {
	id: number;
	kind: IngestTaskKind;
	priority: number;
	status: IngestTaskStatus;
	attempts: number;
	notBefore: Date;
	deadline: Date | null;
	/** Becsült hívásszám; hiányában 1. */
	estCalls?: number;
}

/** A worker hibafajtái (az api-client `ApiErrorKind`-jából képezi le a hívó). */
export type TaskFailureKind = 'plan' | 'token' | 'permanent' | 'quota' | 'budget' | 'transient';

export interface RetryPolicy {
	maxAttempts: number;
	baseDelayMs: number;
	maxDelayMs: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = { maxAttempts: 5, baseDelayMs: 15 * 60_000, maxDelayMs: 6 * 3_600_000 };

const isExpired = (t: QueueTask, now: Date) => t.deadline !== null && t.deadline.getTime() <= now.getTime();

/** Futtatható-e most: `pending`, esedékes, a határidő még nem járt le. */
export const isRunnable = (t: QueueTask, now: Date): boolean =>
	t.status === 'pending' && t.notBefore.getTime() <= now.getTime() && !isExpired(t, now);

/**
 * A lekésett `pending` feladatok → `skipped` (§7.3; a dashboard a kihagyott snapshotok arányát mutatja).
 * A beragadt `running` sorok visszaállítása a tár dolga (TODO(polish): I5 / stale-claim).
 */
export const expiredTaskIds = (tasks: readonly QueueTask[], now: Date): number[] =>
	tasks.filter((t) => t.status === 'pending' && isExpired(t, now)).map((t) => t.id);

/** Rendezés: prioritás ↑, határidő ↑ (nincs = utolsó), not_before ↑, id ↑. */
export const compareTasks = (a: QueueTask, b: QueueTask): number =>
	a.priority - b.priority ||
	(a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity) ||
	a.notBefore.getTime() - b.notBefore.getTime() ||
	a.id - b.id;

/**
 * A következő futtatandó feladat, vagy `null`. Ha a legfontosabbhoz nincs elég keret (`remainingCalls`), nem ugorja át:
 * egy olcsóbb, kevésbé fontos feladat nem élheti fel a magasabb prioritás (pl. `odds_late`) keretét.
 */
export const selectNextTask = (tasks: readonly QueueTask[], now: Date, remainingCalls = Infinity): QueueTask | null => {
	const next = tasks.filter((t) => isRunnable(t, now)).sort(compareTasks)[0];
	if (!next) return null;
	return (next.estCalls ?? 1) <= remainingCalls ? next : null;
};

export interface TaskFailureUpdate {
	status: IngestTaskStatus;
	attempts: number;
	notBefore: Date;
	lastError: string;
}

const nextUtcMidnight = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));

/**
 * Sikertelen futás utáni állapot (§7.3). `plan`/`token`/`permanent` → `failed` (ugyanaz jönne, és fogyna a kvóta);
 * `quota`/`budget` → aznap nem ismétlődik, a következő UTC-napon újra (`attempts` nem nő); `transient` → exponenciális
 * visszalépés, `maxAttempts` után `failed`.
 */
export const onTaskFailure = (
	task: Pick<QueueTask, 'attempts' | 'notBefore'>,
	failure: { kind: TaskFailureKind; message: string },
	now: Date,
	policy: RetryPolicy = DEFAULT_RETRY_POLICY
): TaskFailureUpdate => {
	const lastError = `${failure.kind}: ${failure.message}`;
	switch (failure.kind) {
		case 'plan':
		case 'token':
		case 'permanent':
			return { status: 'failed', attempts: task.attempts + 1, notBefore: task.notBefore, lastError };
		case 'quota':
		case 'budget':
			return { status: 'pending', attempts: task.attempts, notBefore: nextUtcMidnight(now), lastError };
		case 'transient': {
			const attempts = task.attempts + 1;
			if (attempts >= policy.maxAttempts) return { status: 'failed', attempts, notBefore: task.notBefore, lastError };
			const delay = Math.min(policy.baseDelayMs * 2 ** (attempts - 1), policy.maxDelayMs);
			return { status: 'pending', attempts, notBefore: new Date(now.getTime() + delay), lastError };
		}
	}
};
