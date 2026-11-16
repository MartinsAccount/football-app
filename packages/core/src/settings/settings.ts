import {
	DAILY_CALL_LIMIT,
	estimateDailyCalls,
	estimateLeagueCallsPerRound,
	estimateOddsStorage,
	STORAGE_LIMIT_BYTES
} from '../budget/budget';
import { formatDecimal } from '../format/format';
import { DEFAULT_EV_THRESHOLD } from '../odds/value';
import { parseJsonOrNull, StoredValueCodec } from '../storage/keyValue';

// Beállítások (PRD 5.3, ROADMAP S22 → 11.4): katalógus, alapértékek, validálás, becslés, piszkozat-diff és (de)szerializálás.
// Platformfüggetlen: a web (MobX `SettingsStore`) és a mobil ugyanezt hívja; a tárolás a `KeyValueStorage`-on át megy.

export interface ISettingsLeague {
	id: number;
	name: string;
	country: string;
	teams: number;
	/** API-Football `coverage` a DB-ből (`GET /api/leagues`); `null` jelző / objektum = nincs adat (nem találjuk ki). */
	coverage: ILeagueCoverage | null;
}

export interface ILeagueCoverage {
	odds: boolean | null;
	injuries: boolean | null;
	statistics: boolean | null;
}

/**
 * Kézi jelölt-lista (Top 5 = D6 kezdés + bővítési jelöltek): offline tartalék és a magyar megjelenítési név forrása.
 * Coverage itt nincs (nem találjuk ki); az a `/api/leagues` katalógusból jön (`leagueCatalog`).
 */
export const SETTINGS_LEAGUES: readonly ISettingsLeague[] = [
	{ id: 39, name: 'Premier League', country: 'Anglia', teams: 20, coverage: null },
	{ id: 140, name: 'La Liga', country: 'Spanyolország', teams: 20, coverage: null },
	{ id: 135, name: 'Serie A', country: 'Olaszország', teams: 20, coverage: null },
	{ id: 78, name: 'Bundesliga', country: 'Németország', teams: 18, coverage: null },
	{ id: 61, name: 'Ligue 1', country: 'Franciaország', teams: 18, coverage: null },
	{ id: 40, name: 'Championship', country: 'Anglia', teams: 24, coverage: null },
	{ id: 88, name: 'Eredivisie', country: 'Hollandia', teams: 18, coverage: null },
	{ id: 94, name: 'Primeira Liga', country: 'Portugália', teams: 18, coverage: null },
	{ id: 271, name: 'NB I', country: 'Magyarország', teams: 12, coverage: null }
];

/** A `GET /api/leagues` sora (szerkezeti típus: a core nem függ a contracttól; a `LeagueDto` ennek megfelel). */
export interface LeagueCatalogRow {
	id: number;
	name: string;
	country: string | null;
	teamCount: number | null;
	coverage: ILeagueCoverage | null;
}

/** Csapatszám a becsléshez, ha a DB-ben sincs (sem `season_team`, sem meccs): óvatos felső-közép érték. */
export const FALLBACK_LEAGUE_TEAMS = 20;

/**
 * A Beállítások Ligák-listája (I18b): a kézi jelöltek (magyar név, sorrend) a DB-katalógussal összefésülve – a csapatszám és a
 * coverage a DB-ből (ha ott van a liga), utána a DB azon ligái, amelyekhez van adat (csapatszám) vagy követjük őket.
 * `rows === null` (nincs szerver) → a kézi lista változatlanul.
 */
export const leagueCatalog = (rows: readonly LeagueCatalogRow[] | null, followed: readonly number[] = []): ISettingsLeague[] => {
	if (!rows) return [...SETTINGS_LEAGUES];
	const byId = new Map(rows.map((r) => [r.id, r]));
	const manual = SETTINGS_LEAGUES.map((l) => {
		const r = byId.get(l.id);
		return r ? { ...l, teams: r.teamCount ?? l.teams, coverage: r.coverage } : l;
	});
	const manualIds = new Set(SETTINGS_LEAGUES.map((l) => l.id));
	const extra = rows
		.filter((r) => !manualIds.has(r.id) && (r.teamCount !== null || followed.includes(r.id)))
		.map((r) => ({
			id: r.id,
			name: r.name,
			country: r.country ?? '',
			teams: r.teamCount ?? FALLBACK_LEAGUE_TEAMS,
			coverage: r.coverage
		}));
	return [...manual, ...extra];
};

export type SettingsMarketKey = 'h2h' | 'ou25' | 'btts';

export interface ISettingsMarket {
	key: SettingsMarketKey;
	label: string;
	hint: string;
	outcomes: number;
}

export const SETTINGS_MARKETS: readonly ISettingsMarket[] = [
	{ key: 'h2h', label: '1X2', hint: 'Végeredmény', outcomes: 3 },
	{ key: 'ou25', label: 'Gól 2,5', hint: 'Több / kevesebb', outcomes: 2 },
	{ key: 'btts', label: 'Mindkét csapat', hint: 'Igen / nem', outcomes: 2 }
];

/** API-Football iroda-id-k. */
export const SETTINGS_BOOKMAKERS: readonly { id: number; name: string }[] = [
	{ id: 8, name: 'Bet365' },
	{ id: 4, name: 'Pinnacle' },
	{ id: 16, name: 'Unibet' },
	{ id: 6, name: 'Bwin' },
	{ id: 11, name: '1xBet' },
	{ id: 3, name: 'Betfair' },
	{ id: 7, name: 'William Hill' },
	{ id: 2, name: 'Marathonbet' }
];

export type Retention = 'opening-closing' | 'all';

export const RETENTION_OPTIONS: readonly { key: Retention; label: string; hint: string; snapshotsPerFixture: number }[] = [
	{ key: 'opening-closing', label: 'Nyitó + záró', hint: '2 snapshot / meccs', snapshotsPerFixture: 2 },
	// 1 korai + átlag 2,5 késői (meccsnaponként) + záró.
	{ key: 'all', label: 'Minden snapshot', hint: '≈ 4,5 / meccs', snapshotsPerFixture: 4.5 }
];

export interface ISettings {
	leagues: number[];
	markets: SettingsMarketKey[];
	bookmakers: number[];
	retention: Retention;
	evThreshold: number;
	minOdds: number;
	maxOdds: number;
	/** Alapegység Ft-ban (tét-lépcső: ×0,5 / ×1 / ×2 / ×5). */
	stakeUnit: number;
	/** Napi hívás-tartalék a backfillnek. */
	backfillReserve: number;
}

export const STAKE_UNITS = [500, 1000, 2000, 5000] as const;

export const DEFAULT_SETTINGS: ISettings = {
	leagues: [39, 140, 135, 78, 61],
	markets: ['h2h', 'ou25', 'btts'],
	bookmakers: [8, 4, 16, 6, 11],
	retention: 'opening-closing',
	evThreshold: DEFAULT_EV_THRESHOLD,
	minOdds: 1.5,
	maxOdds: 4,
	stakeUnit: 1000,
	backfillReserve: 10
};

export const NUMBER_LIMITS = {
	evThreshold: { min: 0, max: 0.5 },
	minOdds: { min: 1.01, max: 20 },
	maxOdds: { min: 1.01, max: 50 },
	backfillReserve: { min: 0, max: DAILY_CALL_LIMIT }
} as const;

/** Liga-id: pozitív egész (a katalógus dinamikus – `/api/leagues` –, ezért nem a kézi listára szűrünk). */
const leagueIds = (xs: unknown): number[] | null =>
	Array.isArray(xs) ? [...new Set(xs.filter((x): x is number => Number.isInteger(x) && x > 0))] : null;

export type NumberField = keyof typeof NUMBER_LIMITS;

const inRange = (x: unknown, f: NumberField): x is number =>
	typeof x === 'number' && Number.isFinite(x) && x >= NUMBER_LIMITS[f].min && x <= NUMBER_LIMITS[f].max;

const known = <T>(xs: unknown, allowed: readonly T[]): T[] | null =>
	Array.isArray(xs) ? allowed.filter((a) => xs.includes(a)) : null;

/** Mentett (esetleg régi / sérült) beállításból érvényes `ISettings`; ismeretlen id-k kiesnek, hibás érték → alap. */
export const sanitizeSettings = (raw: unknown): ISettings => {
	const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<Record<keyof ISettings, unknown>>;
	const d = DEFAULT_SETTINGS;
	const num = (f: NumberField) => (inRange(r[f], f) ? (r[f] as number) : d[f]);
	let minOdds = num('minOdds');
	let maxOdds = num('maxOdds');
	if (minOdds >= maxOdds) [minOdds, maxOdds] = [d.minOdds, d.maxOdds];
	return {
		leagues: leagueIds(r.leagues) ?? d.leagues,
		markets:
			known(
				r.markets,
				SETTINGS_MARKETS.map((m) => m.key)
			) ?? d.markets,
		bookmakers:
			known(
				r.bookmakers,
				SETTINGS_BOOKMAKERS.map((b) => b.id)
			) ?? d.bookmakers,
		retention: RETENTION_OPTIONS.some((o) => o.key === r.retention) ? (r.retention as Retention) : d.retention,
		evThreshold: num('evThreshold'),
		minOdds,
		maxOdds,
		stakeUnit: (STAKE_UNITS as readonly unknown[]).includes(r.stakeUnit) ? (r.stakeUnit as number) : d.stakeUnit,
		backfillReserve: Math.round(num('backfillReserve'))
	};
};

/** Magyar tizedes bevitel („1,5”, „ 2.10 ”) → szám; üres / hibás → null. */
export const parseDecimalInput = (input: string): number | null => {
	const s = input.trim().replace(/\s/g, '').replace(',', '.');
	if (!/^\d+(\.\d+)?$/.test(s)) return null;
	return Number(s);
};

/** Egy számmező bevitele → érték a mező egységében (EV: % → arány), tartományon kívül null. */
export const parseNumberField = (field: NumberField, input: string): number | null => {
	const x = parseDecimalInput(input);
	if (x === null) return null;
	const value = field === 'evThreshold' ? x / 100 : field === 'backfillReserve' ? Math.round(x) : x;
	return inRange(value, field) ? value : null;
};

/** Az űrlap kezdő szövege egy számmezőhöz (EV %-ban, tizedesvesszővel). */
export const numberFieldText = (field: NumberField, value: number): string =>
	String(field === 'evThreshold' ? Math.round(value * 1000) / 10 : value).replace('.', ',');

/** Listás beállítás (liga / piac / iroda) egy elemének ki-be kapcsolása; az eredmény érvényes `ISettings`. */
export const toggleSettingsItem = <K extends 'leagues' | 'markets' | 'bookmakers'>(
	s: ISettings,
	field: K,
	item: ISettings[K][number]
): ISettings => {
	const xs = s[field] as unknown[];
	return sanitizeSettings({ ...s, [field]: xs.includes(item) ? xs.filter((x) => x !== item) : [...xs, item] });
};

/** Számmező beírása; tartományon kívül vagy min. odds ≥ max. odds esetén null (a hívó jelzi a hibát). */
export const withSettingsNumber = (s: ISettings, field: NumberField, value: number): ISettings | null => {
	const next = { ...s, [field]: value };
	if (!inRange(value, field) || next.minOdds >= next.maxOdds) return null;
	return sanitizeSettings(next);
};

/** Tét-lépcső az alapegységből (DESIGN §7.6: 500 / 1 000 / 2 000 / 5 000 Ft az 1 000-es egységnél). */
export const stakeOptions = (unit: number): number[] => [0.5, 1, 2, 5].map((k) => Math.round(unit * k));

export const fixturesPerRound = (l: ISettingsLeague) => Math.floor(l.teams / 2);
export const fixturesPerSeason = (l: ISettingsLeague) => l.teams * (l.teams - 1);

/** Forduló/hét (budget.ts alap: 1,3) → napi átlag egy ligára. */
const ROUNDS_PER_WEEK = 1.3;

export interface ISettingsEstimate {
	/** Liga-id → átlagos napi hívás. */
	leagueDaily: Map<number, number>;
	dailyAverage: number;
	peakDay: number;
	/** Átlagnap + backfill-tartalék. */
	dailyWithReserve: number;
	/** Csúcsnap + backfill-tartalék. */
	peakWithReserve: number;
	storageBytes: number;
	storageShare: number;
	seasonsInLimit: number;
	rowsPerSeason: number;
}

export const selectedLeagues = (s: ISettings, catalog: readonly ISettingsLeague[] = SETTINGS_LEAGUES) =>
	catalog.filter((l) => s.leagues.includes(l.id));

/** A becslés a megadott katalógus csapatszámaival (alap: a kézi lista; szinkron állapotban a `leagueCatalog` eredménye). */
export const estimateSettings = (s: ISettings, catalog: readonly ISettingsLeague[] = SETTINGS_LEAGUES): ISettingsEstimate => {
	const leagues = selectedLeagues(s, catalog);
	const daily = estimateDailyCalls(leagues.map((l) => ({ fixturesPerRound: fixturesPerRound(l) })));
	const leagueDaily = new Map(
		catalog.map((l) => [
			l.id,
			(estimateLeagueCallsPerRound({ fixturesPerRound: fixturesPerRound(l) }).total * ROUNDS_PER_WEEK) / 7
		])
	);
	const outcomes = SETTINGS_MARKETS.filter((m) => s.markets.includes(m.key)).reduce((sum, m) => sum + m.outcomes, 0);
	const snapshots = RETENTION_OPTIONS.find((o) => o.key === s.retention)!.snapshotsPerFixture;
	const storage = estimateOddsStorage({
		fixturesPerSeason: leagues.reduce((sum, l) => sum + fixturesPerSeason(l), 0),
		snapshotsPerFixture: snapshots,
		bookmakers: s.bookmakers.length,
		outcomes
	});
	return {
		leagueDaily,
		dailyAverage: daily.dailyAverage,
		peakDay: daily.peakDay,
		dailyWithReserve: daily.dailyAverage + s.backfillReserve,
		peakWithReserve: daily.peakDay + s.backfillReserve,
		storageBytes: storage.bytes,
		storageShare: storage.shareOfLimit,
		seasonsInLimit: storage.seasonsInLimit,
		rowsPerSeason: storage.rows
	};
};

export interface ISettingsWarning {
	text: string;
	danger: boolean;
}

/** Figyelmeztetések (PRD 7.5: „figyelmeztet, ha a keret nem elég”). */
export const settingsWarnings = (s: ISettings, e: ISettingsEstimate): ISettingsWarning[] => {
	const out: ISettingsWarning[] = [];
	if (!s.leagues.length) out.push({ text: 'Nincs kiválasztott liga: nem lesz adat és ajánlás.', danger: true });
	if (!s.markets.length) out.push({ text: 'Nincs kiválasztott piac: nem lesz ajánlás.', danger: true });
	if (!s.bookmakers.length) out.push({ text: 'Nincs kiválasztott iroda: nem tárolunk oddsot.', danger: true });
	else if (s.bookmakers.length < 5)
		out.push({ text: 'Ötnél kevesebb iroda: a piaci konszenzus (5 iroda) csak a teljes válaszból számolható.', danger: false });
	if (e.peakWithReserve > DAILY_CALL_LIMIT)
		out.push({
			text: `A csúcsnap (tartalékkal) túllépi a napi ${DAILY_CALL_LIMIT} hívást: kevesebb liga vagy kisebb tartalék kell.`,
			danger: true
		});
	else if (e.peakWithReserve > DAILY_CALL_LIMIT * 0.8)
		out.push({ text: 'A csúcsnap a napi keret 80%-a fölött van: kevés hely marad az újrapróbálásra.', danger: false });
	if (e.storageShare > 1) out.push({ text: 'Egy szezon oddsa nem fér el az 500 MB-os tárhelyen.', danger: true });
	else if (e.seasonsInLimit < 3) out.push({ text: 'A tárhely 3 szezonnál kevesebbre elég.', danger: false });
	return out;
};

/**
 * A liga hiányzó coverage-elemei (CHANGES 5.): csak ezek jelennek meg, warning színnel; ha minden megvan, üres.
 * Csak a tárolt `false` jelző számít hiánynak; ismeretlen (`null`) coverage-ből nem jelzünk semmit.
 */
export const missingCoverage = (l: ISettingsLeague): string[] => {
	const out: string[] = [];
	const c = l.coverage;
	if (c?.odds === false) out.push('Odds nincs');
	if (c?.injuries === false) out.push('Sérültek nincs');
	if (c?.statistics === false) out.push('Statisztika nincs');
	return out;
};

const MB = 1024 * 1024;

const diffPart = (label: string, before: string, after: string, unit = '') =>
	`${label}: ${before === after ? after : `${before} → ${after}`}${unit}`;

/** Mentés-sáv szövege: „Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB” (mentett → piszkozat becslése). */
export const settingsDiff = (saved: ISettingsEstimate, draft: ISettingsEstimate): string =>
	[
		diffPart('Napi hívás', formatDecimal(saved.dailyWithReserve, 0), formatDecimal(draft.dailyWithReserve, 0)),
		diffPart('Tárhely/szezon', formatDecimal(saved.storageBytes / MB, 1), formatDecimal(draft.storageBytes / MB, 1), ' MB')
	].join(' · ');

/** Két beállítás azonos-e (a piszkozat `dirty` jelzőjéhez); a listák sorrendje nem számít. */
export const sameSettings = (a: ISettings, b: ISettings): boolean => {
	const norm = (s: ISettings) =>
		JSON.stringify({
			...s,
			leagues: [...s.leagues].sort((x, y) => x - y),
			markets: [...s.markets].sort(),
			bookmakers: [...s.bookmakers].sort((x, y) => x - y)
		});
	return norm(a) === norm(b);
};

// ── Tárolás (ROADMAP 11.4) ──────────────────────────────────────────────────────────────────────────────────────────

/** A webes localStorage-kulcs (változatlan, a meglévő mentés megmarad). */
export const SETTINGS_STORAGE_KEY = 'oe_settings';

/**
 * Formátum-verzió. v1 = verziómező nélküli `ISettings` JSON (a mai mentés). Formátumváltáskor: `v` mező + ág a
 * `migrateSettings`-ben; a régi alak továbbra is olvasható marad.
 */
export const SETTINGS_FORMAT_VERSION = 1;

/** Tárolt (bármely verziójú) nyers érték → v1 alak; ma azonosság (a `sanitizeSettings` tűri a hiányt / szemetet). */
export const migrateSettings = (raw: unknown): unknown => raw;

export const settingsCodec: StoredValueCodec<ISettings> = {
	key: SETTINGS_STORAGE_KEY,
	decode: (raw) => sanitizeSettings(migrateSettings(parseJsonOrNull(raw))),
	encode: (settings) => JSON.stringify(settings)
};
