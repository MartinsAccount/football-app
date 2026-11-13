import { action, computed, observable } from 'mobx';
import { ThemeName, ThemePreference, themes, THEME_STORAGE_KEY } from '../design/tokens/tokens';

/**
 * A téma környezete (DESIGN §3.1). Tesztben cserélhető; alapból localStorage + matchMedia + `<html data-theme>`.
 * Az `index.html` inline scriptje ugyanígy old fel festés előtt (`?theme=` → localStorage → rendszer), ez a store
 * onnan veszi át az állapotot, és a váltásokat írja.
 */
export interface IThemeEnv {
	/** `?theme=light|dark` – csak erre a betöltésre szól, nem mentjük. */
	urlTheme(): string | null;
	load(): string | null;
	save(preference: ThemePreference): void;
	systemPrefersLight(): boolean;
	/** Rendszer-téma változásának figyelése; a visszaadott függvény leiratkozik. */
	onSystemChange(listener: (prefersLight: boolean) => void): () => void;
	apply(theme: ThemeName): void;
}

const LIGHT_QUERY = '(prefers-color-scheme: light)';

export const browserThemeEnv: IThemeEnv = {
	urlTheme: () => {
		try {
			return new URLSearchParams(window.location.search).get('theme');
		} catch {
			return null;
		}
	},
	load: () => {
		try {
			return window.localStorage.getItem(THEME_STORAGE_KEY);
		} catch {
			return null;
		}
	},
	save: (preference) => {
		try {
			if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY);
			else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
		} catch {
			// privát ablak / tiltott tároló: a váltás erre a munkamenetre így is él
		}
	},
	systemPrefersLight: () => {
		try {
			return window.matchMedia(LIGHT_QUERY).matches;
		} catch {
			return false;
		}
	},
	onSystemChange: (listener) => {
		try {
			const mq = window.matchMedia(LIGHT_QUERY);
			const handler = (e: MediaQueryListEvent) => listener(e.matches);
			mq.addEventListener('change', handler);
			return () => mq.removeEventListener('change', handler);
		} catch {
			return () => undefined;
		}
	},
	apply: (theme) => {
		const root = document.documentElement;
		root.dataset.theme = theme;
		// A böngésző-keret színe a vászon tokenjéből (a meta az index.html-ben tartalom nélkül áll).
		document.querySelector('meta[name="theme-color"]')?.setAttribute('content', themes[theme].color.bg.canvas);
	}
};

const isTheme = (x: unknown): x is ThemeName => x === 'dark' || x === 'light';

/** Téma-preferencia: `system | dark | light` (DESIGN §3.1). A fejléc-váltó és később a Beállítások is ezt állítja. */
export class ThemeStore {
	@observable preference: ThemePreference;
	@observable systemLight: boolean;

	constructor(private env: IThemeEnv = browserThemeEnv) {
		const url = env.urlTheme();
		const stored = env.load();
		this.preference = isTheme(url) ? url : isTheme(stored) ? stored : 'system';
		this.systemLight = env.systemPrefersLight();
		env.onSystemChange(
			action((light: boolean) => {
				this.systemLight = light;
				if (this.preference === 'system') this.env.apply(this.effective);
			})
		);
		env.apply(this.effective);
	}

	/** A ténylegesen megjelenített téma. */
	@computed get effective(): ThemeName {
		if (this.preference !== 'system') return this.preference;
		return this.systemLight ? 'light' : 'dark';
	}

	@action setPreference(preference: ThemePreference) {
		this.preference = preference;
		this.env.save(preference);
		this.env.apply(this.effective);
	}

	/** Fejléc-váltó: a megjelenített téma ellenkezője, kézi választásként mentve. */
	@action toggle() {
		this.setPreference(this.effective === 'dark' ? 'light' : 'dark');
	}
}
