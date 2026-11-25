import { describe, expect, it } from 'vitest';
import { memoryKeyValueStorage, saveStoredSync, loadStored } from '../storage/keyValue';
import { effectiveTheme, resolveThemePreference, themeCodec, THEME_STORAGE_KEY, toggledTheme } from './theme';

describe('theme', () => {
	it('resolves the preference: URL, then stored, then system', () => {
		expect(resolveThemePreference('light', 'dark')).toBe('light');
		expect(resolveThemePreference(null, 'dark')).toBe('dark');
		expect(resolveThemePreference('pink', 'pink')).toBe('system');
	});

	it('maps system to the OS theme and toggles the shown theme', () => {
		expect(effectiveTheme('system', true)).toBe('light');
		expect(effectiveTheme('system', false)).toBe('dark');
		expect(effectiveTheme('dark', true)).toBe('dark');
		expect(toggledTheme('dark')).toBe('light');
	});

	it('stores dark/light as plain text under oe-theme and removes the key for system', async () => {
		const s = memoryKeyValueStorage();
		saveStoredSync(s, themeCodec, 'light');
		expect(s.snapshot()).toEqual({ [THEME_STORAGE_KEY]: 'light' });
		expect(THEME_STORAGE_KEY).toBe('oe-theme');
		expect(await loadStored(s, themeCodec)).toBe('light');
		saveStoredSync(s, themeCodec, 'system');
		expect(s.snapshot()).toEqual({});
		expect(themeCodec.decode('garbage')).toBe('system');
	});
});
