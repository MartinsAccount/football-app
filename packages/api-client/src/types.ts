/** Az API-Football v3 közös válaszburka (docs/api/api-football.md §3). */
export interface ApiEnvelope<T = unknown> {
	get: string;
	parameters: Record<string, string> | unknown[];
	/** Tömb vagy objektum (pl. `{ plan: '…' }`); ha nem üres, a hívás sikertelen. */
	errors: unknown[] | Record<string, string>;
	results: number;
	paging?: { current: number; total: number };
	response: T[];
}

export type ApiParams = Record<string, string | number | undefined>;

/** Atomikus napi foglalás (UTC-nap). `reserve` az új `used` értéket adja, vagy `null`-t, ha nincs keret. */
export interface BudgetStore {
	reserve(day: string, cap?: number): Promise<number | null>;
	/** A `/status` szerinti maradék kvóta rögzítése (egyeztetés). */
	sync(day: string, remaining: number): Promise<void>;
	usage(day: string): Promise<{ used: number; limit: number; reserve: number; syncedRemaining: number | null }>;
}

export interface CallLogEntry {
	endpoint: string;
	params: Record<string, string>;
	httpStatus: number | null;
	errors: unknown;
	results: number | null;
	pagingTotal: number | null;
	quotaRemainingDay: number | null;
	rateRemainingMin: number | null;
	durationMs: number;
	taskId?: number | null;
	mock: boolean;
}

export interface CallLogger {
	log(entry: CallLogEntry): Promise<void>;
}

/** Minimális HTTP-szállító (a globális `fetch` részhalmaza), tesztben cserélhető. */
export type FetchLike = (
	url: string,
	init: { method: 'GET'; headers: Record<string, string> }
) => Promise<{ status: number; ok: boolean; headers: { get(name: string): string | null }; json(): Promise<unknown> }>;

/** Mock-mód: kulcs = `fixtureKey(endpoint, params)`, érték = a mentett válaszburok. */
export type MockFixtures = Record<string, ApiEnvelope>;

export type ClientMode = 'mock' | 'live';
