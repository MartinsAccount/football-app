import { DEFAULT_SETTINGS, NUMBER_LIMITS, RETENTION_OPTIONS, STAKE_UNITS } from '@football/core';
import type { MarketRow, SettingsRepository, StoredFlagRow } from '@football/db';
import type {
	FollowedLeagueInputDto,
	SettingsResponse,
	SettingsUpdate,
	SettingValuesDto,
	TeamFilterDto
} from '@football/contract';

/**
 * Beállítás-API (ROADMAP 2.1b, I3): `GET/PUT /api/settings` a `SettingsRepository` fölött. A PUT-törzs teljes egészében
 * validálódik, mielőtt bármi íródna – érvénytelen elem → `SettingsValidationError` (a router 400 `bad-request`-re fordítja).
 */
export class SettingsValidationError extends Error {}

type ValueKey = keyof SettingValuesDto;

/**
 * DTO-mező → `setting.key`. A 0005-ös migráció alapsorainak kulcsait használja (`unit_ft`, `stake_mode`, `backfill_cap`,
 * `odds_retention`); a `backfill_reserve` új kulcs. Az `odds_retention` a DB-ben logikai érték (true = nyitó + záró).
 */
export const SETTING_KEYS = {
	evThreshold: 'ev_threshold',
	minOdds: 'min_odds',
	maxOdds: 'max_odds',
	stakeUnit: 'unit_ft',
	stakeMode: 'stake_mode',
	backfillCap: 'backfill_cap',
	backfillReserve: 'backfill_reserve',
	retention: 'odds_retention'
} as const satisfies Record<ValueKey, string>;

const VALUE_KEYS = Object.keys(SETTING_KEYS) as ValueKey[];
const STAKE_MODES: readonly SettingValuesDto['stakeMode'][] = ['flat', 'fractional-kelly'];

/** Alapérték, ha a `setting` sor hiányzik vagy érvénytelen: a core `DEFAULT_SETTINGS`, ill. a 0005-ös alapsor. */
export const DEFAULT_SETTING_VALUES: SettingValuesDto = {
	evThreshold: DEFAULT_SETTINGS.evThreshold,
	minOdds: DEFAULT_SETTINGS.minOdds,
	maxOdds: DEFAULT_SETTINGS.maxOdds,
	stakeUnit: DEFAULT_SETTINGS.stakeUnit,
	stakeMode: 'flat',
	backfillCap: 70,
	backfillReserve: DEFAULT_SETTINGS.backfillReserve,
	retention: DEFAULT_SETTINGS.retention
};

const intIn = (v: unknown, min: number, max: number) => Number.isInteger(v) && (v as number) >= min && (v as number) <= max;

/** Egy (DTO-alakú) érték érvényes-e (a core `NUMBER_LIMITS`, `STAKE_UNITS`, `RETENTION_OPTIONS` szerint). */
function isValidValue(key: ValueKey, v: unknown): boolean {
	switch (key) {
		case 'retention':
			return RETENTION_OPTIONS.some((o) => o.key === v);
		case 'stakeMode':
			return (STAKE_MODES as readonly unknown[]).includes(v);
		case 'stakeUnit':
			return (STAKE_UNITS as readonly unknown[]).includes(v);
		case 'backfillCap':
			return intIn(v, 0, NUMBER_LIMITS.backfillReserve.max);
		case 'backfillReserve':
			return intIn(v, NUMBER_LIMITS[key].min, NUMBER_LIMITS[key].max);
		default:
			return typeof v === 'number' && Number.isFinite(v) && v >= NUMBER_LIMITS[key].min && v <= NUMBER_LIMITS[key].max;
	}
}

/** DTO-érték → `setting.value` (csak a megőrzés tér el: logikai érték). */
const toDb = (key: ValueKey, v: unknown): unknown => (key === 'retention' ? v === 'opening-closing' : v);
const fromDb = (key: ValueKey, v: unknown): unknown =>
	key === 'retention' && typeof v === 'boolean' ? (v ? 'opening-closing' : 'all') : v;

/** Nyers `setting` sorok → típusos értékek; hiányzó vagy (kézzel elrontott) érvénytelen érték → alapérték. */
export function settingValuesFrom(raw: Record<string, unknown>): SettingValuesDto {
	const out = { ...DEFAULT_SETTING_VALUES } as Record<ValueKey, unknown>;
	for (const k of VALUE_KEYS) {
		const v = fromDb(k, raw[SETTING_KEYS[k]]);
		if (isValidValue(k, v)) out[k] = v;
	}
	const values = out as unknown as SettingValuesDto;
	if (values.minOdds >= values.maxOdds)
		[values.minOdds, values.maxOdds] = [DEFAULT_SETTING_VALUES.minOdds, DEFAULT_SETTING_VALUES.maxOdds];
	return values;
}

export async function readSettings(repo: SettingsRepository): Promise<SettingsResponse> {
	const [raw, followedLeagues, teamFilters, markets, bookmakers] = await Promise.all([
		repo.getSettings(),
		repo.listFollowedLeagues(),
		repo.listTeamFilters(),
		repo.listMarkets(),
		repo.listBookmakers()
	]);
	return { values: settingValuesFrom(raw), followedLeagues, teamFilters, markets, bookmakers };
}

// ── Validálás ───────────────────────────────────────────────────────────────────────────────────────────────────────

const fail = (msg: string): never => {
	throw new SettingsValidationError(msg);
};

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function obj(x: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
	if (!isObj(x)) return fail(`'${path}' objektum legyen`);
	for (const k of Object.keys(x)) if (!allowed.includes(k)) fail(`ismeretlen mező: '${path}.${k}'`);
	return x;
}

function arr(x: unknown, path: string): unknown[] {
	if (!Array.isArray(x)) return fail(`'${path}' tömb legyen`);
	return x;
}

function posInt(x: unknown, path: string): number {
	if (!Number.isSafeInteger(x) || (x as number) < 1) fail(`'${path}' pozitív egész szám legyen`);
	return x as number;
}

function bool(x: unknown, path: string): boolean {
	if (typeof x !== 'boolean') fail(`'${path}' logikai érték legyen`);
	return x as boolean;
}

const SMALLINT = { min: -32768, max: 32767 };

export interface SettingsUpdateContext {
	markets: readonly MarketRow[];
	bookmakers: readonly StoredFlagRow[];
	/** A törzsben hivatkozott, de a `league` / `team` táblában nem létező id-k (FK) – ezek 400-at adnak. */
	missing?: { leagueIds: readonly number[]; teamIds: readonly number[] };
	current: SettingValuesDto;
}

/** Nyers PUT-törzs → érvényes `SettingsUpdate`; bármely hiba → `SettingsValidationError` (írás nélkül). */
export function parseSettingsUpdate(body: unknown, ctx: SettingsUpdateContext): SettingsUpdate {
	const b = obj(body, 'body', ['values', 'followedLeagues', 'teamFilters', 'markets', 'bookmakers']);
	const out: SettingsUpdate = {};

	if (b.values !== undefined) {
		const v = obj(b.values, 'values', VALUE_KEYS);
		const values: Partial<Record<ValueKey, unknown>> = {};
		for (const k of VALUE_KEYS) {
			if (v[k] === undefined) continue;
			if (!isValidValue(k, v[k])) fail(`érvénytelen érték: 'values.${k}' = ${JSON.stringify(v[k])}`);
			values[k] = v[k];
		}
		const merged = { ...ctx.current, ...values } as SettingValuesDto;
		if (merged.minOdds >= merged.maxOdds) fail(`'minOdds' (${merged.minOdds}) kisebb legyen, mint 'maxOdds' (${merged.maxOdds})`);
		out.values = values as Partial<SettingValuesDto>;
	}

	const marketKeys = new Set(ctx.markets.flatMap((m) => (m.code === null ? [String(m.id)] : [m.code, String(m.id)])));
	if (b.followedLeagues !== undefined) {
		const f = obj(b.followedLeagues, 'followedLeagues', ['upsert', 'remove']);
		out.followedLeagues = {
			upsert:
				f.upsert === undefined
					? undefined
					: arr(f.upsert, 'followedLeagues.upsert').map((x, i) => {
							const p = `followedLeagues.upsert[${i}]`;
							const l = obj(x, p, ['leagueId', 'enabled', 'priority', 'markets']);
							const input: FollowedLeagueInputDto = { leagueId: posInt(l.leagueId, `${p}.leagueId`) };
							if (l.enabled !== undefined) input.enabled = bool(l.enabled, `${p}.enabled`);
							if (l.priority !== undefined) {
								if (
									!Number.isInteger(l.priority) ||
									(l.priority as number) < SMALLINT.min ||
									(l.priority as number) > SMALLINT.max
								)
									fail(`'${p}.priority' egész szám legyen [${SMALLINT.min}, ${SMALLINT.max}] között`);
								input.priority = l.priority as number;
							}
							if (l.markets !== undefined) {
								input.markets =
									l.markets === null
										? null
										: arr(l.markets, `${p}.markets`).map((m) => {
												if (typeof m !== 'string' || !marketKeys.has(m))
													fail(`ismeretlen piackód: '${p}.markets' → ${JSON.stringify(m)}`);
												return m as string;
										  });
							}
							return input;
					  }),
			remove:
				f.remove === undefined
					? undefined
					: arr(f.remove, 'followedLeagues.remove').map((x, i) => posInt(x, `followedLeagues.remove[${i}]`))
		};
	}

	if (b.teamFilters !== undefined) {
		const t = obj(b.teamFilters, 'teamFilters', ['upsert', 'remove']);
		out.teamFilters = {
			upsert:
				t.upsert === undefined
					? undefined
					: arr(t.upsert, 'teamFilters.upsert').map((x, i): TeamFilterDto => {
							const p = `teamFilters.upsert[${i}]`;
							const f = obj(x, p, ['teamId', 'mode']);
							if (f.mode !== 'include' && f.mode !== 'exclude') fail(`'${p}.mode' 'include' vagy 'exclude' legyen`);
							return { teamId: posInt(f.teamId, `${p}.teamId`), mode: f.mode as TeamFilterDto['mode'] };
					  }),
			remove:
				t.remove === undefined
					? undefined
					: arr(t.remove, 'teamFilters.remove').map((x, i) => posInt(x, `teamFilters.remove[${i}]`))
		};
	}

	const flags = (key: 'markets' | 'bookmakers', known: readonly { id: number }[]) => {
		const ids = new Set(known.map((k) => k.id));
		return arr(b[key], key).map((x, i) => {
			const p = `${key}[${i}]`;
			const f = obj(x, p, ['id', 'stored']);
			const id = posInt(f.id, `${p}.id`);
			if (!ids.has(id)) fail(`ismeretlen ${key === 'markets' ? 'piac' : 'iroda'}: '${p}.id' = ${id}`);
			return { id, stored: bool(f.stored, `${p}.stored`) };
		});
	};
	if (b.markets !== undefined) out.markets = flags('markets', ctx.markets);
	if (b.bookmakers !== undefined) out.bookmakers = flags('bookmakers', ctx.bookmakers);
	return out;
}

/**
 * PUT: validál (a jelenlegi állapothoz mérve), majd sorban ír. TODO(polish): egy tranzakcióban (ma a validálás előre fut,
 * így csak DB-hiba hagyhat félig alkalmazott frissítést).
 */
export async function applySettingsUpdate(repo: SettingsRepository, body: unknown): Promise<SettingsResponse> {
	const [raw, markets, bookmakers] = await Promise.all([repo.getSettings(), repo.listMarkets(), repo.listBookmakers()]);
	const current = settingValuesFrom(raw);
	const u = parseSettingsUpdate(body, { markets, bookmakers, current });
	const missing = await repo.findMissingRefs({
		leagueIds: (u.followedLeagues?.upsert ?? []).map((l) => l.leagueId),
		teamIds: (u.teamFilters?.upsert ?? []).map((t) => t.teamId)
	});
	if (missing.leagueIds.length) fail(`ismeretlen liga: ${missing.leagueIds.join(', ')}`);
	if (missing.teamIds.length) fail(`ismeretlen csapat: ${missing.teamIds.join(', ')}`);

	for (const k of VALUE_KEYS) if (u.values?.[k] !== undefined) await repo.setSetting(SETTING_KEYS[k], toDb(k, u.values[k]));
	for (const m of u.markets ?? []) await repo.setMarketStored(m.id, m.stored);
	for (const bm of u.bookmakers ?? []) await repo.setBookmakerStored(bm.id, bm.stored);
	for (const id of u.followedLeagues?.remove ?? []) await repo.removeFollowedLeague(id);
	for (const l of u.followedLeagues?.upsert ?? []) await repo.upsertFollowedLeague(l);
	for (const id of u.teamFilters?.remove ?? []) await repo.removeTeamFilter(id);
	for (const t of u.teamFilters?.upsert ?? []) await repo.upsertTeamFilter(t);
	return readSettings(repo);
}
