// Feladatsor-planner (architecture.md §7.1). Tiszta: a „mit kell lekérni” döntés I/O nélkül; a tár (ingest_task) az I5-ben.
// Idempotens: ugyanarra a bemenetre ugyanazokat a `dedupeKey`-eket adja, a tár `ON CONFLICT (dedupe_key) DO NOTHING`-gal szűr.

export type IngestTaskKind =
	| 'odds_late'
	| 'injuries'
	| 'odds_early'
	| 'results'
	| 'standings'
	| 'fixtures_window'
	| 'reference'
	| 'predictions_api'
	| 'backfill';

export type IngestTaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'skipped';

/** Kisebb szám = előbb fut (§7.1 táblázat). */
export const TASK_PRIORITY: Readonly<Record<IngestTaskKind, number>> = {
	odds_late: 1,
	injuries: 2,
	odds_early: 2,
	results: 3,
	standings: 3,
	fixtures_window: 3,
	reference: 4,
	predictions_api: 4,
	backfill: 5
};

export type TaskParamValue = string | number | number[];

export interface TaskPlan {
	kind: IngestTaskKind;
	dedupeKey: string;
	params: Record<string, TaskParamValue>;
	priority: number;
	notBefore: Date;
	deadline: Date | null;
	/** Becsült API-hívás (a worker ennyi keretet vár el indulás előtt). */
	estCalls: number;
}

export interface PlannerLeague {
	id: number;
	season: number;
}

export interface PlannerFixture {
	id: number;
	leagueId: number;
	kickoff: Date;
	/** API `fixture.status.short` (NS, FT, PST …). */
	status: string;
	round?: string | null;
}

export interface PlannerInput {
	now: Date;
	leagues: readonly PlannerLeague[];
	fixtures: readonly PlannerFixture[];
	/** Ennyi órán belüli kezdésű meccsekre tervez előre (alap 72). */
	horizonHours?: number;
}

/** Ezeknél a státuszoknál nincs több eredmény-lekérés. */
export const FINAL_FIXTURE_STATUSES: readonly string[] = ['FT', 'AET', 'PEN', 'CANC', 'ABD', 'AWD', 'WO'];

/** `/odds` 10 meccs/oldal; `fixtures?ids=`, `injuries?ids=` ≤ 20 id/hívás (api-football.md). */
export const ODDS_PAGE_SIZE = 10;
export const IDS_BATCH = 20;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const utcDay = (d: Date): string => d.toISOString().slice(0, 10);
const utcMidnight = (d: Date): Date => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const utcMonth = (d: Date): string => d.toISOString().slice(0, 7);

/** ISO 8601 hét: `2026-W47`. */
export const isoWeek = (d: Date): string => {
	const t = utcMidnight(d);
	const dow = t.getUTCDay() || 7;
	t.setUTCDate(t.getUTCDate() + 4 - dow); // a hét csütörtöke dönti el az évet
	const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
	const week = Math.ceil(((t.getTime() - yearStart) / DAY + 1) / 7);
	return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const chunk = <T>(xs: readonly T[], size: number): T[][] => {
	const out: T[][] = [];
	for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
	return out;
};

const groupBy = <T>(xs: readonly T[], key: (x: T) => string): Map<string, T[]> => {
	const m = new Map<string, T[]>();
	for (const x of xs) {
		const k = key(x);
		const list = m.get(k);
		if (list) list.push(x);
		else m.set(k, [x]);
	}
	return m;
};

const byKickoff = (a: PlannerFixture, b: PlannerFixture) => a.kickoff.getTime() - b.kickoff.getTime() || a.id - b.id;

const plan = (
	kind: IngestTaskKind,
	dedupeKey: string,
	params: TaskPlan['params'],
	notBefore: Date,
	deadline: Date | null,
	estCalls = 1
): TaskPlan => ({
	kind,
	dedupeKey,
	params,
	priority: TASK_PRIORITY[kind],
	notBefore,
	deadline,
	estCalls
});

/**
 * A hiányzó feladatok terve a beállított ligákra. Determinisztikus (dedupe_key szerint rendezve), lejárt határidejű
 * terv nem kerül bele. `predictions_api` és `backfill` itt még nincs (TODO: külön szelet).
 */
export const planTasks = (input: PlannerInput): TaskPlan[] => {
	const { now } = input;
	const nowMs = now.getTime();
	const horizonMs = (input.horizonHours ?? 72) * HOUR;
	const out: TaskPlan[] = [];
	const leagues = new Map(input.leagues.map((l) => [l.id, l]));

	// Törzsadat: hetente a bukméker- és fogadástípus-lista, havonta ligánként a csapatok.
	const week = isoWeek(now);
	out.push(plan('reference', `reference:bookmakers:${week}`, { endpoint: 'odds/bookmakers' }, now, null));
	out.push(plan('reference', `reference:bets:${week}`, { endpoint: 'odds/bets' }, now, null));

	for (const l of leagues.values()) {
		const day = utcDay(now);
		const dayStart = utcMidnight(now);
		out.push(
			plan(
				'fixtures_window',
				`fixtures_window:${l.id}:${l.season}:${day}`,
				{ league: l.id, season: l.season, from: day, to: utcDay(new Date(dayStart.getTime() + 7 * DAY)) },
				new Date(dayStart.getTime() + 4 * HOUR),
				new Date(dayStart.getTime() + DAY)
			)
		);
		out.push(
			plan(
				'reference',
				`reference:teams:${l.id}:${l.season}:${utcMonth(now)}`,
				{ endpoint: 'teams', league: l.id, season: l.season },
				now,
				null
			)
		);
	}

	const followed = input.fixtures.filter((f) => leagues.has(f.leagueId));

	// Kezdés előtti feladatok: liga × meccsnap (UTC). Egy meccsnap egészben kerül be, ha az első kezdése a horizonton belül
	// van – különben a horizont szélén részleges csoport kapná meg végleg a dedupe_key-t.
	const upcoming: PlannerFixture[] = [];
	const matchDays: PlannerFixture[][] = [];
	const days = groupBy(
		followed.filter((f) => f.kickoff.getTime() > nowMs && f.status === 'NS'),
		(f) => `${f.leagueId}:${utcDay(f.kickoff)}`
	);
	for (const fx of days.values()) {
		fx.sort(byKickoff);
		if (fx[0].kickoff.getTime() - nowMs > horizonMs) continue;
		matchDays.push(fx);
		upcoming.push(...fx);
	}
	for (const fx of matchDays) {
		const { leagueId, kickoff: first } = fx[0];
		const season = leagues.get(leagueId)!.season;
		const day = utcDay(first);
		const t0 = first.getTime();
		const ids = fx.map((f) => f.id);
		const pages = Math.ceil(ids.length / ODDS_PAGE_SIZE);
		out.push(
			plan(
				'odds_early',
				`odds_early:${leagueId}:${day}`,
				{ league: leagueId, season, date: day, fixtures: ids },
				new Date(t0 - 48 * HOUR),
				new Date(t0 - 24 * HOUR),
				pages
			)
		);
		out.push(
			plan(
				'odds_late',
				`odds_late:${leagueId}:${day}`,
				{ league: leagueId, season, date: day, fixtures: ids },
				new Date(t0 - 3 * HOUR),
				first,
				pages
			)
		);
		chunk(ids, IDS_BATCH).forEach((batch, i) =>
			out.push(plan('injuries', `injuries:${leagueId}:${day}:${i}`, { ids: batch }, new Date(t0 - 24 * HOUR), first))
		);
	}

	// Tabella: a forduló (ha nincs, a meccsnap) előtti UTC-nap.
	for (const fx of groupBy(upcoming, (f) => `${f.leagueId}:${f.round ?? utcDay(f.kickoff)}`).values()) {
		fx.sort(byKickoff);
		const { leagueId, kickoff: first } = fx[0];
		const season = leagues.get(leagueId)!.season;
		const round = fx[0].round ?? utcDay(first);
		out.push(
			plan(
				'standings',
				`standings:${leagueId}:${season}:${round}`,
				{ league: leagueId, season },
				new Date(utcMidnight(first).getTime() - DAY),
				first
			)
		);
	}

	// Eredmények: 1. kör kezdés +3 h, 2. kör +26 h – csak ha esedékes és a meccs még nem végleges.
	const passes = [
		{ pass: 1, from: 3 * HOUR, to: 26 * HOUR },
		{ pass: 2, from: 26 * HOUR, to: 72 * HOUR }
	];
	for (const p of passes) {
		const due = followed.filter((f) => {
			const k = f.kickoff.getTime();
			return !FINAL_FIXTURE_STATUSES.includes(f.status) && k + p.from <= nowMs && nowMs < k + p.to;
		});
		// Csoport = liga × pontos kezdés: ezek egyszerre válnak esedékessé, így a köteg összetétele (és a kulcs) stabil.
		for (const fx of groupBy(due, (f) => `${f.leagueId}:${f.kickoff.toISOString()}`).values()) {
			fx.sort(byKickoff);
			const { leagueId, kickoff } = fx[0];
			const k = kickoff.getTime();
			const slot = kickoff.toISOString().slice(0, 16);
			chunk(
				fx.map((f) => f.id),
				IDS_BATCH
			).forEach((batch, i) =>
				out.push(
					plan('results', `results:${leagueId}:${slot}:p${p.pass}:${i}`, { ids: batch }, new Date(k + p.from), new Date(k + p.to))
				)
			);
		}
	}

	return out
		.filter((t) => t.deadline === null || t.deadline.getTime() > nowMs)
		.sort((a, b) => (a.dedupeKey < b.dedupeKey ? -1 : a.dedupeKey > b.dedupeKey ? 1 : 0));
};
