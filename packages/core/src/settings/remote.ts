import {
	DEFAULT_SETTINGS,
	ISettings,
	ISettingsLeagueMarkets,
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
	/** `markets`: ligánkénti piac-felülírás (piackód vagy id szövegként), `null` = globális; hiányában (régi szerver) a helyi marad. */
	followedLeagues: readonly { leagueId: number; enabled: boolean; markets?: readonly string[] | null }[];
	/** A szerver mindig küldi; hiányában (régi szerver) a helyi mentés csapatszűrői maradnak. */
	teamFilters?: readonly ISettingsTeamFilter[];
	markets: readonly { id: number; stored: boolean; code?: string | null }[];
	bookmakers: readonly { id: number; stored: boolean }[];
}

/** A `SettingsUpdate` része, amit a leképezés küld (a `stakeMode` és a `backfillCap` érintetlen marad). */
export interface RemoteSettingsUpdate {
	values?: Partial<RemoteSettingsShape['values']>;
	followedLeagues?: { upsert: { leagueId: number; enabled: boolean; markets?: string[] | null }[] };
	teamFilters?: { upsert?: ISettingsTeamFilter[]; remove?: number[] };
	markets?: { id: number; stored: boolean }[];
	bookmakers?: { id: number; stored: boolean }[];
}

const flagged = (rows: readonly { id: number; stored: boolean }[]) => new Map(rows.map((r) => [r.id, r.stored]));

const KEY_BY_ID = new Map(Object.entries(SETTINGS_MARKET_IDS).map(([k, id]) => [id, k as SettingsMarketKey]));

/**
 * `followed_league.markets` → piac-kulcsok (I18f). Elem: id szövegként („8”) vagy `market.code`; a h2h/ou25/btts-re nem
 * leképezhető elem kimarad (a webes felület csak ezt a hármat kezeli).
 */
export const leagueMarketsFromRemote = (raw: readonly string[], markets: RemoteSettingsShape['markets']): SettingsMarketKey[] => {
	const byCode = new Map(markets.filter((m) => m.code != null).map((m) => [m.code as string, m.id]));
	const keys = raw.map((x) => KEY_BY_ID.get(/^\d+$/.test(x) ? Number(x) : byCode.get(x) ?? -1));
	return SETTINGS_MARKETS.map((m) => m.key).filter((k) => keys.includes(k));
};

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
		leagueMarkets: remote.followedLeagues.flatMap((l): ISettingsLeagueMarkets[] => {
			if (l.markets === undefined) return fallback.leagueMarkets.filter((o) => o.leagueId === l.leagueId);
			return l.markets === null ? [] : [{ leagueId: l.leagueId, markets: leagueMarketsFromRemote(l.markets, remote.markets) }];
		}),
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
	const upsert = new Map<number, { leagueId: number; enabled: boolean; markets?: string[] | null }>();
	for (const l of toggled(saved.leagues, draft.leagues)) upsert.set(l.id, { leagueId: l.id, enabled: l.on });
	// Piac-felülírás (I18f): változott → `markets` (id szövegként, csak a DB-ben létező piacok; `null` = vissza a globálisra).
	// Az `enabled` mindig megy vele, hogy egy még nem követett liga sora ne jöjjön létre követettként.
	const override = (s: ISettings, id: number) => s.leagueMarkets.find((o) => o.leagueId === id)?.markets ?? null;
	const overrideIds = [...new Set([...saved.leagueMarkets, ...draft.leagueMarkets].map((o) => o.leagueId))].sort((a, b) => a - b);
	const knownMarkets = new Set(remote.markets.map((m) => m.id));
	for (const id of overrideIds) {
		const before = override(saved, id);
		const after = override(draft, id);
		if (JSON.stringify(before) === JSON.stringify(after)) continue;
		upsert.set(id, {
			leagueId: id,
			enabled: draft.leagues.includes(id),
			markets:
				after &&
				after
					.map((k) => SETTINGS_MARKET_IDS[k])
					.filter((m) => knownMarkets.has(m))
					.map(String)
		});
	}
	if (upsert.size) out.followedLeagues = { upsert: [...upsert.values()] };

	// Csapatszűrő: új vagy módváltott → upsert; a piszkozatból hiányzó → törlés (a `team_filter` sor ekkor felesleges).
	const savedMode = new Map(saved.teamFilters.map((t) => [t.teamId, t.mode]));
	const draftIds = new Set(draft.teamFilters.map((t) => t.teamId));
	const teamUpsert = draft.teamFilters.filter((t) => savedMode.get(t.teamId) !== t.mode).map((t) => ({ ...t }));
	const remove = saved.teamFilters.filter((t) => !draftIds.has(t.teamId)).map((t) => t.teamId);
	if (teamUpsert.length || remove.length)
		out.teamFilters = { ...(teamUpsert.length ? { upsert: teamUpsert } : {}), ...(remove.length ? { remove } : {}) };

	const known = (rows: readonly { id: number }[]) => new Set(rows.map((r) => r.id));
	const marketIds = (s: ISettings) => s.markets.map((k) => SETTINGS_MARKET_IDS[k]);
	const markets = toggled(marketIds(saved), marketIds(draft)).filter((m) => known(remote.markets).has(m.id));
	if (markets.length) out.markets = markets.map((m) => ({ id: m.id, stored: m.on }));
	const bookmakers = toggled(saved.bookmakers, draft.bookmakers).filter((b) => known(remote.bookmakers).has(b.id));
	if (bookmakers.length) out.bookmakers = bookmakers.map((b) => ({ id: b.id, stored: b.on }));

	return Object.keys(out).length ? out : null;
};
