import type {
	ApiErrorBody,
	ArbitrageResponse,
	BacktestResponse,
	BudgetResponse,
	FixtureQuery,
	FixtureResponse,
	FixturesResponse,
	OddsHistoryResponse,
	OddsResponse,
	RecommendationsResponse,
	SettingsResponse,
	SettingsUpdate
} from './dto';

/**
 * Platformfüggetlen olvasó-API kliens (ADR-0010): csak `fetch`-et használ, nincs DOM-, Node- vagy storage-függés,
 * így böngészőben, Node-ban és React Native alatt is fut. A `fetch` injektálható (teszt, egyedi hálózati réteg).
 */

/** A `fetch` minimális része, amire a kliensnek szüksége van (szándékosan nem a DOM `typeof fetch`). */
export interface FetchResponseLike {
	ok: boolean;
	status: number;
	text(): Promise<string>;
}
export type FetchLike = (
	url: string,
	init: { method: string; headers: Record<string, string>; body?: string }
) => Promise<FetchResponseLike>;

export interface ApiClientOptions {
	/** Pl. `https://app.example.com` vagy `''` (azonos origin). A végéről a `/` levágódik. */
	baseUrl: string;
	/** Ha van: `Authorization: Bearer <token>`. */
	token?: string;
	/** Alapértelmezés: a globális `fetch`. */
	fetch?: FetchLike;
}

/** Típusos API-hiba. `status` 0 = hálózati hiba (nincs HTTP-válasz). */
export class ApiError extends Error {
	readonly status: number;
	readonly error: string;
	constructor(status: number, error: string, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
		this.error = error;
	}
}

export interface ApiClient {
	listFixtures(query?: FixtureQuery): Promise<FixturesResponse>;
	getFixture(fixtureId: number): Promise<FixtureResponse>;
	getOdds(fixtureId: number): Promise<OddsResponse>;
	/** A meccs összes odds-pillanatképe időrendben (meccs-részlet, odds-mozgás). */
	getOddsHistory(fixtureId: number): Promise<OddsHistoryResponse>;
	getBudget(): Promise<BudgetResponse>;
	getRecommendations(): Promise<RecommendationsResponse>;
	getBacktest(): Promise<BacktestResponse>;
	/** Drótforma (`sum: null`); a hívó `reviveArbitrageSnapshot`-tal alakítja vissza. */
	getArbitrage(): Promise<ArbitrageResponse>;
	/** A teljes beállítás-állapot (értékek, követett ligák, csapatszűrők, tárolt piacok/irodák). */
	getSettings(): Promise<SettingsResponse>;
	/** Részleges frissítés (`PUT`); a válasz a frissített állapot. Érvénytelen elem → `ApiError` 400, semmi sem íródik. */
	updateSettings(update: SettingsUpdate): Promise<SettingsResponse>;
}

/** `FixtureQuery` → query-string a `parseFixtureQuery` paraméterneveivel (`status` vesszővel). Üres értéket kihagy. */
export function buildFixtureQuery(query: FixtureQuery = {}): string {
	const pairs: [string, string][] = [];
	const add = (name: string, value: string | number | undefined) => {
		if (value === undefined || value === '') return;
		pairs.push([name, String(value)]);
	};
	add('league', query.league);
	add('season', query.season);
	add('status', query.status?.filter(Boolean).join(','));
	add('from', query.from);
	add('to', query.to);
	add('limit', query.limit);
	add('offset', query.offset);
	return pairs.length ? '?' + pairs.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&') : '';
}

const isErrorBody = (x: unknown): x is ApiErrorBody =>
	typeof x === 'object' &&
	x !== null &&
	typeof (x as ApiErrorBody).error === 'string' &&
	typeof (x as ApiErrorBody).message === 'string';

export function createApiClient(options: ApiClientOptions): ApiClient {
	const baseUrl = options.baseUrl.replace(/\/+$/, '');
	const g = globalThis as { fetch?: FetchLike };
	// A globális fetch-et hívás közben, a globalThis-en hívjuk (néhány környezet "Illegal invocation"-t dob leválasztva).
	const doFetch: FetchLike | undefined = options.fetch ?? (g.fetch ? (url, init) => g.fetch!(url, init) : undefined);

	async function request<T>(method: 'GET' | 'PUT', path: string, payload?: unknown): Promise<T> {
		if (!doFetch) throw new ApiError(0, 'network', 'Nincs elérhető fetch');
		const headers: Record<string, string> = { accept: 'application/json' };
		if (options.token) headers.authorization = `Bearer ${options.token}`;
		const init: { method: string; headers: Record<string, string>; body?: string } = { method, headers };
		if (payload !== undefined) {
			headers['content-type'] = 'application/json';
			init.body = JSON.stringify(payload);
		}

		let res: FetchResponseLike;
		try {
			res = await doFetch(baseUrl + path, init);
		} catch (e) {
			throw new ApiError(0, 'network', e instanceof Error ? e.message : String(e));
		}

		const text = await res.text();
		let body: unknown;
		try {
			body = text ? JSON.parse(text) : undefined;
		} catch {
			body = undefined;
		}
		if (!res.ok) {
			if (isErrorBody(body)) throw new ApiError(res.status, body.error, body.message);
			throw new ApiError(res.status, 'http', `HTTP ${res.status}`);
		}
		if (body === undefined) throw new ApiError(res.status, 'invalid-response', 'A válasz nem JSON');
		return body as T;
	}
	const get = <T>(path: string) => request<T>('GET', path);

	return {
		listFixtures: (query) => get<FixturesResponse>(`/api/fixtures${buildFixtureQuery(query)}`),
		getFixture: (fixtureId) => get<FixtureResponse>(`/api/fixtures/${encodeURIComponent(String(fixtureId))}`),
		getOddsHistory: (fixtureId) => get<OddsHistoryResponse>(`/api/odds/${encodeURIComponent(String(fixtureId))}/history`),
		getOdds: (fixtureId) => get<OddsResponse>(`/api/odds/${encodeURIComponent(String(fixtureId))}`),
		getBudget: () => get<BudgetResponse>('/api/budget'),
		getRecommendations: () => get<RecommendationsResponse>('/api/recommendations'),
		getBacktest: () => get<BacktestResponse>('/api/backtest'),
		getArbitrage: () => get<ArbitrageResponse>('/api/arbitrage'),
		getSettings: () => get<SettingsResponse>('/api/settings'),
		updateSettings: (update) => request<SettingsResponse>('PUT', '/api/settings', update)
	};
}
