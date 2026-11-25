import { describe, expect, it } from 'vitest';
import { ThemeName, ThemePreference } from '../design/tokens/tokens';
import { THEME_OPTIONS } from '../pages/SettingsPage/settingsView';
import { IThemeEnv, ThemeStore } from './ThemeStore';

const fakeEnv = (opts: { url?: string | null; stored?: string | null; light?: boolean } = {}) => {
	const state = {
		stored: opts.stored ?? null,
		applied: [] as ThemeName[],
		listener: null as ((light: boolean) => void) | null
	};
	const env: IThemeEnv = {
		urlTheme: () => opts.url ?? null,
		load: () => state.stored,
		save: (p: ThemePreference) => {
			state.stored = p === 'system' ? null : p;
		},
		systemPrefersLight: () => !!opts.light,
		onSystemChange: (l) => {
			state.listener = l;
			return () => undefined;
		},
		apply: (t) => {
			state.applied.push(t);
		}
	};
	return { env, state };
};

describe('ThemeStore', () => {
	it('follows the system when nothing is stored', () => {
		const { env, state } = fakeEnv({ light: true });
		const store = new ThemeStore(env);
		expect(store.preference).toBe('system');
		expect(store.effective).toBe('light');
		expect(state.applied).toEqual(['light']);
	});

	it('uses the stored choice over the system, and ignores junk', () => {
		expect(new ThemeStore(fakeEnv({ stored: 'dark', light: true }).env).effective).toBe('dark');
		expect(new ThemeStore(fakeEnv({ stored: 'pink', light: false }).env).preference).toBe('system');
	});

	it('lets ?theme= win for this load without saving it', () => {
		const { env, state } = fakeEnv({ url: 'light', stored: 'dark' });
		const store = new ThemeStore(env);
		expect(store.effective).toBe('light');
		expect(state.stored).toBe('dark');
	});

	it('toggle saves the opposite of the shown theme and applies it', () => {
		const { env, state } = fakeEnv({ light: false });
		const store = new ThemeStore(env);
		store.toggle();
		expect(store.preference).toBe('light');
		expect(state.stored).toBe('light');
		expect(state.applied.at(-1)).toBe('light');
		store.toggle();
		expect(state.stored).toBe('dark');
	});

	it('setPreference("system") clears the stored choice', () => {
		const { env, state } = fakeEnv({ stored: 'light', light: false });
		const store = new ThemeStore(env);
		store.setPreference('system');
		expect(state.stored).toBeNull();
		expect(store.effective).toBe('dark');
	});

	it('re-applies on a system change only while following the system', () => {
		const { env, state } = fakeEnv({ light: false });
		const store = new ThemeStore(env);
		state.listener!(true);
		expect(store.effective).toBe('light');
		expect(state.applied.at(-1)).toBe('light');
		store.setPreference('dark');
		state.listener!(false);
		state.listener!(true);
		expect(state.applied.at(-1)).toBe('dark');
	});

	it('the Settings appearance options and the header toggle set the same preference (CHANGES 5.)', () => {
		const { env, state } = fakeEnv({ light: false });
		const store = new ThemeStore(env);
		const pressed = () => THEME_OPTIONS.filter((o) => o.key === store.preference).map((o) => o.label);
		expect(pressed()).toEqual(['Rendszer']);
		// Beállítások → Világos: a fejléc-váltó ezt látja, és onnan vált tovább.
		store.setPreference('light');
		expect(state.stored).toBe('light');
		store.toggle();
		expect(store.preference).toBe('dark');
		expect(state.stored).toBe('dark');
		expect(pressed()).toEqual(['Sötét']);
		// Vissza a rendszerre a Beállításokból: a mentett kézi választás törlődik.
		store.setPreference('system');
		expect(state.stored).toBeNull();
		expect(pressed()).toEqual(['Rendszer']);
	});
});
