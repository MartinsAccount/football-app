import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
	DEFAULT_SETTINGS,
	leagueCatalog,
	loadStored,
	saveStored,
	settingsCodec,
	settingsFromRemote,
	settingsUpdateFrom,
	themeCodec,
	type ISettings,
	type ISettingsLeague,
	type LeagueCatalogRow,
	type RemoteSettingsShape,
	type ThemePreference
} from '@football/core';
import type { LeagueTeamsResponse } from '@football/contract';
import { apiClientFor, loadConnection } from '@/lib/connection';
import { asyncKeyValueStorage } from '@/lib/storage';

/** `off`: nincs API-cím · `loading` · `synced`: a szerver az igazság · `offline`: nem érhető el, csak a helyi mentés. */
export type SettingsSyncStatus = 'off' | 'loading' | 'synced' | 'offline';

/**
 * Beállítások (`oe_settings`) és téma (`oe-theme`) AsyncStorage-ban, a web formátumával (core codec-ek). Ha van API-cím, a
 * szerver `GET/PUT /api/settings` az igazság (I18d, mint a web `SettingsStore`-ja): a PUT csak a különbséget küldi, az
 * AsyncStorage gyorsítótár (első festés, offline). A Ligák-lista a `GET /api/leagues` katalógusából (core `leagueCatalog`).
 */
interface Preferences {
	loaded: boolean;
	settings: ISettings;
	/** Mentés; szerverhiba esetén dob (a hívó jelzi), a helyi mentett állapot ekkor nem változik. */
	saveSettings: (settings: ISettings) => Promise<void>;
	syncStatus: SettingsSyncStatus;
	/** Szerver-állapot újratöltése (a képernyő fókuszakor: a kapcsolat közben beállítható). */
	sync: () => Promise<void>;
	/** A Ligák-lista: kézi jelöltek + DB-katalógus (szerver nélkül a kézi lista). */
	leagues: ISettingsLeague[];
	/** Egy liga csapatai (csapatszűrő); API-cím nélkül dob. */
	loadTeams: (leagueId: number) => Promise<LeagueTeamsResponse>;
	themePreference: ThemePreference;
	setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const PreferencesContext = createContext<Preferences>({
	loaded: false,
	settings: DEFAULT_SETTINGS,
	saveSettings: async () => {},
	syncStatus: 'off',
	sync: async () => {},
	leagues: leagueCatalog(null),
	loadTeams: () => Promise.reject(new Error('Nincs API-kapcsolat')),
	themePreference: 'system',
	setThemePreference: async () => {}
});

const client = async () => {
	const connection = await loadConnection();
	return connection.baseUrl ? apiClientFor(connection) : null;
};

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [loaded, setLoaded] = useState(false);
	const [settings, setSettings] = useState<ISettings>(DEFAULT_SETTINGS);
	const [themePreference, setTheme] = useState<ThemePreference>('system');
	const [syncStatus, setSyncStatus] = useState<SettingsSyncStatus>('off');
	const [catalogRows, setCatalogRows] = useState<readonly LeagueCatalogRow[] | null>(null);
	// A PUT-diffhez az utolsó szerver-válasz (mely piac/iroda sor létezik a DB-ben) és a mentett állapot friss értéke.
	const remoteRef = useRef<RemoteSettingsShape | null>(null);
	const settingsRef = useRef(settings);

	const applySaved = useCallback(async (next: ISettings) => {
		settingsRef.current = next;
		setSettings(next);
		await saveStored(asyncKeyValueStorage, settingsCodec, next);
	}, []);

	const sync = useCallback(async () => {
		const api = await client();
		if (!api) {
			remoteRef.current = null;
			setSyncStatus('off');
			return;
		}
		setSyncStatus('loading');
		// A katalógus a beállításoktól függetlenül tölt; hibánál csendben a kézi lista marad.
		void api.listLeagues().then(
			(r) => setCatalogRows(r.leagues),
			() => setCatalogRows(null)
		);
		try {
			const res = await api.getSettings();
			remoteRef.current = res;
			await applySaved(settingsFromRemote(res, settingsRef.current));
			setSyncStatus('synced');
		} catch {
			remoteRef.current = null;
			setSyncStatus('offline');
		}
	}, [applySaved]);

	useEffect(() => {
		void Promise.all([loadStored(asyncKeyValueStorage, settingsCodec), loadStored(asyncKeyValueStorage, themeCodec)]).then(
			([s, theme]) => {
				settingsRef.current = s;
				setSettings(s);
				setTheme(theme);
				setLoaded(true);
				void sync();
			}
		);
	}, [sync]);

	const saveSettings = useCallback(
		async (draft: ISettings) => {
			const remote = remoteRef.current;
			const update = remote ? settingsUpdateFrom(settingsRef.current, draft, remote) : null;
			const api = update ? await client() : null;
			if (api && update) {
				const res = await api.updateSettings(update);
				remoteRef.current = res;
				await applySaved(settingsFromRemote(res, draft));
			} else await applySaved(draft);
		},
		[applySaved]
	);

	const loadTeams = useCallback(async (leagueId: number) => {
		const api = await client();
		if (!api) throw new Error('Nincs API-kapcsolat');
		return api.listLeagueTeams(leagueId);
	}, []);

	const setThemePreference = useCallback(async (preference: ThemePreference) => {
		setTheme(preference);
		await saveStored(asyncKeyValueStorage, themeCodec, preference);
	}, []);

	const leagues = useMemo(() => leagueCatalog(catalogRows, settings.leagues), [catalogRows, settings.leagues]);

	const value = useMemo(
		() => ({
			loaded,
			settings,
			saveSettings,
			syncStatus,
			sync,
			leagues,
			loadTeams,
			themePreference,
			setThemePreference
		}),
		[loaded, settings, saveSettings, syncStatus, sync, leagues, loadTeams, themePreference, setThemePreference]
	);
	return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = (): Preferences => useContext(PreferencesContext);
