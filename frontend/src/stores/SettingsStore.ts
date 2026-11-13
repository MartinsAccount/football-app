import { action, computed, observable } from 'mobx';
import {
	estimateSettings,
	ISettings,
	ISettingsEstimate,
	ISettingsWarning,
	NumberField,
	Retention,
	sanitizeSettings,
	SettingsMarketKey,
	settingsWarnings,
	stakeOptions
} from '../pages/SettingsPage/settingsView';

/** A beállítások tárolója. TODO(polish): DB `setting` tábla a backend-íróval (most localStorage). */
export interface ISettingsStorage {
	load(): unknown;
	save(settings: ISettings): void;
}

const STORAGE_KEY = 'oe_settings';

export const localSettingsStorage: ISettingsStorage = {
	load: () => {
		try {
			const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
			return raw ? JSON.parse(raw) : null;
		} catch {
			return null;
		}
	},
	save: (settings) => {
		if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}
};

const toggle = <T>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/** `/settings` állapota (PRD 5.3); minden változás azonnal mentődik. A becslés a core `budget/`-ből. */
export class SettingsStore {
	@observable.ref settings: ISettings;

	constructor(private storage: ISettingsStorage = localSettingsStorage) {
		this.settings = sanitizeSettings(storage.load());
	}

	@computed get estimate(): ISettingsEstimate {
		return estimateSettings(this.settings);
	}

	@computed get warnings(): ISettingsWarning[] {
		return settingsWarnings(this.settings, this.estimate);
	}

	@computed get stakeOptions(): number[] {
		return stakeOptions(this.settings.stakeUnit);
	}

	@action private update(patch: Partial<ISettings>) {
		this.settings = sanitizeSettings({ ...this.settings, ...patch });
		this.storage.save(this.settings);
	}

	toggleLeague = (id: number) => this.update({ leagues: toggle(this.settings.leagues, id) });
	toggleMarket = (key: SettingsMarketKey) => this.update({ markets: toggle(this.settings.markets, key) });
	toggleBookmaker = (id: number) => this.update({ bookmakers: toggle(this.settings.bookmakers, id) });
	setRetention = (retention: Retention) => this.update({ retention });
	setStakeUnit = (stakeUnit: number) => this.update({ stakeUnit });

	/** Érvényes számot ír be; min ≥ max esetén false (a hívó jelzi a hibát). */
	setNumber = (field: NumberField, value: number): boolean => {
		const next = { ...this.settings, [field]: value };
		if (next.minOdds >= next.maxOdds) return false;
		this.update({ [field]: value });
		return true;
	};

	reset = () => this.update(sanitizeSettings(null));
}
