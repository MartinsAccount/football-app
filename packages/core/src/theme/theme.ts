import { StoredValueCodec } from '../storage/keyValue';

// Téma-preferencia (DESIGN §3.1, ROADMAP 11.4): tiszta feloldás webnek és mobilnak. A környezet (URL, matchMedia /
// Appearance, `<html data-theme>`) a platform store-jában marad.

export type ThemeName = 'dark' | 'light';
export type ThemePreference = ThemeName | 'system';

/** A webes localStorage-kulcs (változatlan; az `index.html` festés előtti scriptje is ezt olvassa). */
export const THEME_STORAGE_KEY = 'oe-theme';

export const isThemeName = (x: unknown): x is ThemeName => x === 'dark' || x === 'light';

/** Kezdő preferencia: `?theme=` (csak erre a betöltésre) → mentett → rendszer. */
export const resolveThemePreference = (urlTheme: unknown, stored: unknown): ThemePreference =>
	isThemeName(urlTheme) ? urlTheme : isThemeName(stored) ? stored : 'system';

/** A ténylegesen megjelenített téma. */
export const effectiveTheme = (preference: ThemePreference, systemPrefersLight: boolean): ThemeName =>
	preference !== 'system' ? preference : systemPrefersLight ? 'light' : 'dark';

/** Fejléc-váltó: a megjelenített téma ellenkezője (kézi választás). */
export const toggledTheme = (current: ThemeName): ThemeName => (current === 'dark' ? 'light' : 'dark');

/** v1 = nyers `dark | light` szöveg; „system” = nincs kulcs (törlés). */
export const themeCodec: StoredValueCodec<ThemePreference> = {
	key: THEME_STORAGE_KEY,
	decode: (raw) => (isThemeName(raw) ? raw : 'system'),
	encode: (preference) => (preference === 'system' ? null : preference)
};
