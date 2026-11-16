import {
	ApiFootballClient,
	ApiFootballError,
	SqlBudgetStore,
	utcDay,
	type BudgetStore,
	type MockFixtures
} from '@football/api-client';
import {
	onTaskFailure,
	planTasks,
	selectNextTask,
	type IngestTaskKind,
	type PlannerInput,
	type RetryPolicy,
	type TaskFailureKind
} from '@football/core';
import { loadPlannerInput, SqlTaskStore, type SqlExecutor, type StoredTask, type TaskStore } from '@football/db';
import type { TickWorker } from './cron';
import { createReferenceHandler } from './reference';
import { remainingCalls } from './router';

/**
 * Ingest-worker a tickben (ROADMAP 3.1b, architecture.md §7.1–§7.3): lejárt → `skipped`, beragadt `running` → `pending`,
 * planner → `enqueue` (dedupe), majd prioritásos végrehajtás a napi maradék kereten belül. A szabályok a core-ban
 * (`ingest/tasks.ts`, `ingest/queue.ts`); a job-végrehajtók kindonkénti handlerek (3.2: `reference`), a többi még no-op.
 */

export interface TaskHandlerContext {
	now: Date;
	/** A szerveroldali API-Football kliens (mock vagy élő); a no-op handler nem használja. */
	client?: ApiFootballClient;
}

/** Egy feladat végrehajtása; a ténylegesen elköltött hívások számát adja (élő módban a kliens foglal budgetet). */
export type TaskHandler = (task: StoredTask, ctx: TaskHandlerContext) => Promise<{ calls: number }>;

export const noopHandler: TaskHandler = async () => ({ calls: 0 });

export interface IngestWorkerDeps {
	tasks: TaskStore;
	budget: Pick<BudgetStore, 'usage'>;
	plannerInput: (now: Date) => Promise<PlannerInput>;
	client?: ApiFootballClient;
	/** Kindonkénti végrehajtó; ami hiányzik, az no-op (TODO: valódi jobok a 3.2–3.x szeletekben). */
	handlers?: Partial<Record<IngestTaskKind, TaskHandler>>;
	/** Egy tick legfeljebb ennyi feladatot futtat (alap 50). */
	maxTasks?: number;
	/** Ennél régebben `running` sor beragadtnak számít (alap 10 perc > egy tick időkerete). */
	staleMs?: number;
	retryPolicy?: RetryPolicy;
	/** Falióra az időkeret-figyeléshez (tesztben cserélhető). */
	clock?: () => number;
}

/** Az api-client hibafajtájából a core sor-hibafajtája (§7.3). Nem API-hiba (pl. hálózat, bug) → átmeneti. */
export function toFailureKind(e: unknown): TaskFailureKind {
	if (!(e instanceof ApiFootballError)) return 'transient';
	switch (e.kind) {
		case 'budget':
		case 'quota':
		case 'plan':
		case 'token':
			return e.kind;
		case 'http':
			return e.retryable ? 'transient' : 'permanent';
		case 'api':
		case 'mock-missing':
			return 'permanent';
	}
}

export function createIngestWorker(deps: IngestWorkerDeps): TickWorker {
	const maxTasks = deps.maxTasks ?? 50;
	const staleMs = deps.staleMs ?? 10 * 60_000;
	const clock = deps.clock ?? Date.now;

	return async ({ now, deadline }) => {
		const stopAt = clock() + Math.max(0, deadline.getTime() - now.getTime());
		const { tasks } = deps;
		await tasks.resetStale(now, staleMs);
		await tasks.skipExpired(now);
		const planned = await tasks.enqueue(planTasks(await deps.plannerInput(now)), now);

		let executed = 0;
		let calls = 0;
		const day = utcDay(now);
		while (executed < maxTasks && clock() < stopAt) {
			const remaining = remainingCalls(await deps.budget.usage(day));
			const next = selectNextTask(await tasks.listRunnable(now), now, remaining) as StoredTask | null;
			if (!next) break;
			if (!(await tasks.claim(next.id, now))) continue;
			const handler = deps.handlers?.[next.kind] ?? noopHandler;
			try {
				const res = await handler(next, { now, client: deps.client });
				calls += res.calls;
				await tasks.complete(next.id, now);
			} catch (e) {
				const message = e instanceof Error ? e.message : String(e);
				await tasks.fail(next.id, onTaskFailure(next, { kind: toFailureKind(e), message }, now, deps.retryPolicy), now);
			}
			executed++;
		}
		return { planned, executed, calls };
	};
}

/**
 * Lokális/dev bekötés: DB-tár + `api_budget_day` + mock kliens (0 élő hívás). A `reference` jobok (3.2) a `fixtures`
 * mock-térképből töltik a törzsadatot (`loadReferenceMocks`); ami hiányzik, az `mock-missing` → végleges hiba. Élő kliens
 * és a többi handler a 3.3+ szeletekben (💸).
 */
export function createDbIngestWorker(
	db: SqlExecutor,
	opts: Pick<IngestWorkerDeps, 'handlers' | 'maxTasks'> & { fixtures?: MockFixtures } = {}
): TickWorker {
	return createIngestWorker({
		tasks: new SqlTaskStore(db),
		budget: new SqlBudgetStore(db),
		plannerInput: (now) => loadPlannerInput(db, now),
		client: new ApiFootballClient({ mode: 'mock', fixtures: opts.fixtures ?? {} }),
		handlers: { reference: createReferenceHandler(db), ...opts.handlers },
		maxTasks: opts.maxTasks
	});
}
