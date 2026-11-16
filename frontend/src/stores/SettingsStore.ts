import { action, computed, flow, observable } from 'mobx';
import {
	estimateSettings,
	ISettings,
	ISettingsEstimate,
	ISettingsLeague,
	LeagueCatalogRow,
	leagueCatalog,
	ISettingsWarning,
	NumberField,
	Retention,
	sameSettings,
	sanitizeSettings,
	SettingsMarketKey,
	settingsDiff,
	settingsWarnings,
	loadStoredSync,
	saveStoredSync,
	settingsCodec,
	settingsFromRemote,
	settingsUpdateFrom,
	RemoteSettingsShape,
	RemoteSettingsUpdate,
	stakeOptions,
	TeamFilterMode,
	withTeamFilter
} from '@football/core';
import { webStorage } from '../shared/storage/webStorage';

/** A beállítások tárolója. TODO(polish): DB `setting` tábla a backend-íróval (most localStorage). */
export interface ISettingsStorage {
	load(): unknown;
	save(settings: ISettings): void;
}

/** localStorage (`oe_settings`) a core `settingsCodec`-kel; az olvasás szinkron (első festés villanás nélkül). */
export const localSettingsStorage: ISettingsStorage = {
	load: () => loadStoredSync(webStorage, settingsCodec),
	save: (settings) => {
		try {
			saveStoredSync(webStorage, settingsCodec, settings);
		} catch {
			// privát ablak / tiltott tároló: a mentett állapot erre a munkamenetre így is él
		}
	}
};

/** A szerver `GET/PUT /api/settings` (I3) – a web a `readApi`-val köti be (MainStore); tesztben hamisítvány. */
export interface ISettingsRemote {
	load(): Promise<RemoteSettingsShape>;
	update(update: RemoteSettingsUpdate): Promise<RemoteSettingsShape>;
	/** Liga-katalógus (`GET /api/leagues`, I18b); hiányában vagy hibánál a kézi lista marad. */
	leagues?(): Promise<readonly LeagueCatalogRow[]>;
	/** Egy liga csapatai (`GET /api/leagues/:id/teams`, I18c); hiányában a csapatszűrő nem tölt csapatot. */
	teams?(leagueId: number): Promise<ILeagueTeams>;
}

/** A csapatszűrő csapatlistája (a contract `LeagueTeamsResponse` része). */
export interface ILeagueTeams {
	season: number | null;
	teams: readonly { id: number; name: string }[];
}

/** Egy liga csapatlistájának állapota: betöltés alatt, betöltve vagy hiba (szerver nélkül / offline). */
export type LeagueTeamsState = 'loading' | 'error' | ILeagueTeams;

/** `off`: nincs szerver bekötve · `loading` · `synced`: a szerver az igazság · `offline`: nem érhető el, csak localStorage. */
export type SettingsSyncStatus = 'off' | 'loading' | 'synced' | 'offline';

const toggle = <T>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/**
 * `/settings` állapota (PRD 5.3). Két réteg: `saved` (localStorage, ezt követi az app – pl. a szelvény tét-lépcsője) és
 * `draft` (az űrlap szerkeszti). A tároló csak `save()`-kor íródik; `discard()` visszaáll a mentettre. A becslés a core `budget/`-ből.
 * A Megjelenés (téma) nem része a piszkozatnak: a `ThemeStore` azonnal hat.
 */
export class SettingsStore {
	@observable.ref saved: ISettings;
	@observable.ref draft: ISettings;
	@observable syncStatus: SettingsSyncStatus = 'off';
	@observable saving = false;
	@observable saveError: string | null = null;
	/** A szerver liga-katalógusa; `null` = nincs (még) betöltve → a kézi `SETTINGS_LEAGUES`. */
	@observable.ref catalogRows: readonly LeagueCatalogRow[] | null = null;
	/** Ligánkénti csapatlista (csapatszűrő, I18c); egyszer töltjük, hibánál újrapróbálható. */
	@observable.ref teamsByLeague: ReadonlyMap<number, LeagueTeamsState> = new Map();
	/** A csapatszűrőben kiválasztott liga; `null` = az első követett liga. */
	@observable teamsLeagueId: number | null = null;
	/** Az utolsó szerver-válasz (a PUT-diffhez: mely piac/iroda sor létezik a DB-ben). */
	private remoteState: RemoteSettingsShape | null = null;

	constructor(private storage: ISettingsStorage = localSettingsStorage, private remote?: ISettingsRemote) {
		this.saved = sanitizeSettings(storage.load());
		this.draft = this.saved;
		if (remote) {
			this.sync();
			this.loadCatalog();
		}
	}

	/** A katalógus a beállításoktól függetlenül töltődik; hiba esetén csendben a kézi lista marad (az `offline` pill jelzi a szervert). */
	loadCatalog = flow(function* (this: SettingsStore) {
		if (!this.remote?.leagues) return;
		try {
			this.catalogRows = yield this.remote.leagues();
		} catch {
			this.catalogRows = null;
		}
	});

	/** A Ligák-lista és a becslés katalógusa: kézi jelöltek + DB-ligák (csapatszám, coverage). */
	@computed get leagues(): ISettingsLeague[] {
		return leagueCatalog(this.catalogRows, this.saved.leagues);
	}

	/** A csapatszűrő ligája: a választott, ha még követett, különben a piszkozat első követett ligája. */
	@computed get teamsLeague(): number | null {
		const ids = this.draft.leagues;
		return this.teamsLeagueId !== null && ids.includes(this.teamsLeagueId) ? this.teamsLeagueId : ids[0] ?? null;
	}

	@computed get teamsState(): LeagueTeamsState | null {
		return this.teamsLeague === null ? null : this.teamsByLeague.get(this.teamsLeague) ?? null;
	}

	@action selectTeamsLeague = (leagueId: number) => {
		this.teamsLeagueId = leagueId;
		this.loadTeams(leagueId);
	};

	/** Csapatlista betöltése (gyorsítótárazva; hiba után újra). Szerver nélkül `error`. */
	loadTeams = flow(function* (this: SettingsStore, leagueId: number) {
		const cur = this.teamsByLeague.get(leagueId);
		if (cur && cur !== 'error') return;
		const set = (state: LeagueTeamsState) => (this.teamsByLeague = new Map(this.teamsByLeague).set(leagueId, state));
		if (!this.remote?.teams) return set('error');
		set('loading');
		try {
			set(yield this.remote.teams(leagueId));
		} catch {
			set('error');
		}
	});

	/** Szerver-állapot betöltése; a localStorage gyorsítótár marad (első festés, offline). Szerkesztett piszkozatot nem ír felül. */
	sync = flow(function* (this: SettingsStore) {
		if (!this.remote) return;
		this.syncStatus = 'loading';
		try {
			const res: RemoteSettingsShape = yield this.remote.load();
			const untouched = !this.dirty;
			this.remoteState = res;
			this.saved = settingsFromRemote(res, this.saved);
			if (untouched) this.draft = this.saved;
			this.storage.save(this.saved);
			this.syncStatus = 'synced';
		} catch {
			this.syncStatus = 'offline';
		}
	});

	@computed get dirty(): boolean {
		return !sameSettings(this.saved, this.draft);
	}

	/** A piszkozat becslése (az űrlap ezt mutatja). */
	@computed get estimate(): ISettingsEstimate {
		return estimateSettings(this.draft, this.leagues);
	}

	@computed get savedEstimate(): ISettingsEstimate {
		return estimateSettings(this.saved, this.leagues);
	}

	/** Mentés-sáv: „Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB”. */
	@computed get diff(): string {
		return settingsDiff(this.savedEstimate, this.estimate);
	}

	@computed get warnings(): ISettingsWarning[] {
		return settingsWarnings(this.draft, this.estimate);
	}

	/** A mentett alapegység tét-lépcsője (a szelvény ezt követi, nem a piszkozatot). */
	@computed get stakeOptions(): number[] {
		return stakeOptions(this.saved.stakeUnit);
	}

	@action private update(patch: Partial<ISettings>) {
		this.draft = sanitizeSettings({ ...this.draft, ...patch });
	}

	toggleLeague = (id: number) => this.update({ leagues: toggle(this.draft.leagues, id) });
	toggleMarket = (key: SettingsMarketKey) => this.update({ markets: toggle(this.draft.markets, key) });
	toggleBookmaker = (id: number) => this.update({ bookmakers: toggle(this.draft.bookmakers, id) });
	/** Csapatszűrő a piszkozatba; `null` = a szűrő törlése (mentés kell hozzá). */
	setTeamFilter = (teamId: number, mode: TeamFilterMode | null) =>
		this.update({ teamFilters: withTeamFilter(this.draft.teamFilters, teamId, mode) });
	setRetention = (retention: Retention) => this.update({ retention });
	setStakeUnit = (stakeUnit: number) => this.update({ stakeUnit });

	/** Érvényes számot ír a piszkozatba; min ≥ max esetén false (a hívó jelzi a hibát). */
	setNumber = (field: NumberField, value: number): boolean => {
		const next = { ...this.draft, [field]: value };
		if (next.minOdds >= next.maxOdds) return false;
		this.update({ [field]: value });
		return true;
	};

	/** Alapértékek a piszkozatba (mentés kell hozzá). */
	reset = () => this.update(sanitizeSettings(null));

	/** Mentés: szinkron állapotban PUT (csak a különbség), a válasz lesz a mentett; offline / bekötés nélkül csak localStorage. */
	save = flow(function* (this: SettingsStore) {
		this.saveError = null;
		if (this.remote && this.remoteState && this.syncStatus === 'synced') {
			const update = settingsUpdateFrom(this.saved, this.draft, this.remoteState);
			if (update) {
				this.saving = true;
				try {
					const res: RemoteSettingsShape = yield this.remote.update(update);
					this.remoteState = res;
					this.saved = settingsFromRemote(res, this.draft);
				} catch (e) {
					this.saveError = e instanceof Error ? e.message : String(e);
					return;
				} finally {
					this.saving = false;
				}
			} else this.saved = this.draft;
		} else this.saved = this.draft;
		this.draft = this.saved;
		this.storage.save(this.saved);
	});

	@action discard = () => {
		this.draft = this.saved;
		this.saveError = null;
	};
}
