import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
	DEFAULT_SETTINGS,
	loadStored,
	saveStored,
	settingsCodec,
	themeCodec,
	type ISettings,
	type ThemePreference
} from '@football/core';
import { asyncKeyValueStorage } from '@/lib/storage';

/**
 * Mentett beállítások (`oe_settings`) és téma-preferencia (`oe-theme`) AsyncStorage-ban, a web formátumával (core codec-ek).
 * Betöltésig az alapértékek élnek (sötét téma helyett a rendszer szerinti, mint a weben mentés nélkül).
 */
interface Preferences {
	loaded: boolean;
	settings: ISettings;
	saveSettings: (settings: ISettings) => Promise<void>;
	themePreference: ThemePreference;
	setThemePreference: (preference: ThemePreference) => Promise<void>;
}

const PreferencesContext = createContext<Preferences>({
	loaded: false,
	settings: DEFAULT_SETTINGS,
	saveSettings: async () => {},
	themePreference: 'system',
	setThemePreference: async () => {}
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
	const [loaded, setLoaded] = useState(false);
	const [settings, setSettings] = useState<ISettings>(DEFAULT_SETTINGS);
	const [themePreference, setTheme] = useState<ThemePreference>('system');

	useEffect(() => {
		void Promise.all([loadStored(asyncKeyValueStorage, settingsCodec), loadStored(asyncKeyValueStorage, themeCodec)]).then(
			([s, theme]) => {
				setSettings(s);
				setTheme(theme);
				setLoaded(true);
			}
		);
	}, []);

	const saveSettings = useCallback(async (next: ISettings) => {
		setSettings(next);
		await saveStored(asyncKeyValueStorage, settingsCodec, next);
	}, []);

	const setThemePreference = useCallback(async (preference: ThemePreference) => {
		setTheme(preference);
		await saveStored(asyncKeyValueStorage, themeCodec, preference);
	}, []);

	const value = useMemo(
		() => ({ loaded, settings, saveSettings, themePreference, setThemePreference }),
		[loaded, settings, saveSettings, themePreference, setThemePreference]
	);
	return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export const usePreferences = (): Preferences => useContext(PreferencesContext);
