import {
	DEFAULT_SETTINGS,
	ISettings,
	ISettingsTeamFilter,
	sanitizeSettings,
	SETTINGS_MARKETS,
	SettingsMarketKey
} from './settings';

// Web/mobil `ISettings` ↔ szerver `GET/PUT /api/settings` (ROADMAP 2.3, I18a). A core nem függhet a `@football/contract`-tól
// (az függ a core-tól), ezért itt a szerver-alak szerkezeti mása áll; a contract `SettingsResponse`/`SettingsUpdate` ennek megfelel.

/** Piac-kulcs → API-Football bet-id (`market.id`): 1 = Match Winner, 5 = Goals Over/Under, 8 = Both Teams Score. */
export const SETTINGS_MARKET_IDS: Readonly<Record<SettingsMarketKey, number>> = { h2h: 1, ou25: 5, btts: 8 };

/** A `SettingsResponse` része, amit a leképezés használ. */
export interface RemoteSettingsShape {
	values: {
		evThreshold: number;
		minOdds: number;
		maxOdds: number;
		stakeUnit: number;
		backfillReserve: number;
		retention: ISettings['retention'];
	};
	followedLeagues: readonly { leagueId: number; enabled: boolean }[];
	/** A szerver mindig küldi; hiányában (régi szerver) a helyi mentés csapatszűrői maradnak. */
	teamFilters?: readonly ISettingsTeamFilter[];
	markets: readonly { id: number; stored: boolean }[];
	bookmakers: readonly { id: number; stored: boolean }[];
}

/** A `SettingsUpdate` része, amit a leképezés küld (a `stakeMode` és a `backfillCap` érintetlen marad). */
export interface RemoteSettingsUpdate {
	values?: Partial<RemoteSettingsShape['values']>;
	followedLeagues?: { upsert: { leagueId: number; enabled: boolean }[] };
	teamFilters?: { upsert?: ISettingsTeamFilter[]; remove?: number[] };
	markets?: { id: number; stored: boolean }[];
	bookmakers?: { id: number; stored: boolean }[];
}

const flagged = (rows: readonly { id: number; stored: boolean }[]) => new Map(rows.map((r) => [r.id, r.stored]));

/**
 * Szerver-állapot → `ISettings`. Liga: az `enabled` követett ligák. Piac/iroda: a DB `stored` jelzője; ha a sor még nincs a
 * DB-ben (a `reference` job nem töltötte be), a `fallback` (helyi mentés) tagsága marad – ezt a PUT nem tudja írni.
 */
export const settingsFromRemote = (remote: RemoteSettingsShape, fallback: ISettings = DEFAULT_SETTINGS): ISettings => {
	const markets = flagged(remote.markets);
	const bookmakers = flagged(remote.bookmakers);
	return sanitizeSettings({
		...remote.values,
		leagues: remote.followedLeagues.filter((l) => l.enabled).map((l) => l.leagueId),
		teamFilters: remote.teamFilters ?? fallback.teamFilters,
		markets: SETTINGS_MARKETS.map((m) => m.key).filter(
			(k) => markets.get(SETTINGS_MARKET_IDS[k]) ?? fallback.markets.includes(k)
		),
		bookmakers: [
			...remote.bookmakers.filter((b) => b.stored).map((b) => b.id),
			...fallback.bookmakers.filter((id) => !bookmakers.has(id))
		]
	});
};

const VALUE_KEYS = ['evThreshold', 'minOdds', 'maxOdds', 'stakeUnit', 'backfillReserve', 'retention'] as const;

/**
 * Mentett → piszkozat különbsége PUT-törzsként (csak a változott elemek). Ligánál a kivétel `enabled: false` upsert (nem
 * törlés: visszafordítható, a prioritás/piac-felülírás megmarad). Piac/iroda csak akkor megy, ha a sor létezik a DB-ben.
 * `null`, ha nincs változás.
 */
export const settingsUpdateFrom = (
	saved: ISettings,
	draft: ISettings,
	remote: Pick<RemoteSettingsShape, 'markets' | 'bookmakers'>
): RemoteSettingsUpdate | null => {
	const out: RemoteSettingsUpdate = {};
	const values: Partial<Record<(typeof VALUE_KEYS)[number], unknown>> = {};
	for (const k of VALUE_KEYS) if (saved[k] !== draft[k]) values[k] = draft[k];
	if (Object.keys(values).length) out.values = values as RemoteSettingsUpdate['values'];

	const toggled = (a: readonly number[], b: readonly number[]) => [
		...b.filter((x) => !a.includes(x)).map((id) => ({ id, on: true })),
		...a.filter((x) => !b.includes(x)).map((id) => ({ id, on: false }))
	];
	const leagues = toggled(saved.leagues, draft.leagues);
	if (leagues.length) out.followedLeagues = { upsert: leagues.map((l) => ({ leagueId: l.id, enabled: l.on })) };

	// Csapatszűrő: új vagy módváltott → upsert; a piszkozatból hiányzó → törlés (a `team_filter` sor ekkor felesleges).
	const savedMode = new Map(saved.teamFilters.map((t) => [t.teamId, t.mode]));
	const draftIds = new Set(draft.teamFilters.map((t) => t.teamId));
	const upsert = draft.teamFilters.filter((t) => savedMode.get(t.teamId) !== t.mode).map((t) => ({ ...t }));
	const remove = saved.teamFilters.filter((t) => !draftIds.has(t.teamId)).map((t) => t.teamId);
	if (upsert.length || remove.length)
		out.teamFilters = { ...(upsert.length ? { upsert } : {}), ...(remove.length ? { remove } : {}) };

	const known = (rows: readonly { id: number }[]) => new Set(rows.map((r) => r.id));
	const marketIds = (s: ISettings) => s.markets.map((k) => SETTINGS_MARKET_IDS[k]);
	const markets = toggled(marketIds(saved), marketIds(draft)).filter((m) => known(remote.markets).has(m.id));
	if (markets.length) out.markets = markets.map((m) => ({ id: m.id, stored: m.on }));
	const bookmakers = toggled(saved.bookmakers, draft.bookmakers).filter((b) => known(remote.bookmakers).has(b.id));
	if (bookmakers.length) out.bookmakers = bookmakers.map((b) => ({ id: b.id, stored: b.on }));

	return Object.keys(out).length ? out : null;
};
