import { action, computed, observable } from 'mobx';
import {
	estimateSettings,
	ISettings,
	ISettingsEstimate,
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
	stakeOptions
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

const toggle = <T>(xs: T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

/**
 * `/settings` állapota (PRD 5.3). Két réteg: `saved` (localStorage, ezt követi az app – pl. a szelvény tét-lépcsője) és
 * `draft` (az űrlap szerkeszti). A tároló csak `save()`-kor íródik; `discard()` visszaáll a mentettre. A becslés a core `budget/`-ből.
 * A Megjelenés (téma) nem része a piszkozatnak: a `ThemeStore` azonnal hat.
 */
export class SettingsStore {
	@observable.ref saved: ISettings;
	@observable.ref draft: ISettings;

	constructor(private storage: ISettingsStorage = localSettingsStorage) {
		this.saved = sanitizeSettings(storage.load());
		this.draft = this.saved;
	}

	@computed get dirty(): boolean {
		return !sameSettings(this.saved, this.draft);
	}

	/** A piszkozat becslése (az űrlap ezt mutatja). */
	@computed get estimate(): ISettingsEstimate {
		return estimateSettings(this.draft);
	}

	@computed get savedEstimate(): ISettingsEstimate {
		return estimateSettings(this.saved);
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

	@action save = () => {
		this.saved = this.draft;
		this.storage.save(this.saved);
	};

	@action discard = () => {
		this.draft = this.saved;
	};
}
