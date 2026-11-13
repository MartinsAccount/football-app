import type { ThemePreference } from '../../design/tokens/tokens';

// `/settings` nézet-modell (PRD 5.3, ROADMAP S22). A tiszta beállítás-logika (katalógus, validálás, becslés, diff,
// (de)szerializálás) a `@football/core` `settings/` moduljában él (ROADMAP 11.4); itt csak a web-specifikus UI-adat marad.
export {
	DAILY_CALL_LIMIT,
	DEFAULT_SETTINGS,
	estimateSettings,
	fixturesPerRound,
	fixturesPerSeason,
	missingCoverage,
	NUMBER_LIMITS,
	numberFieldText,
	parseDecimalInput,
	parseNumberField,
	RETENTION_OPTIONS,
	sameSettings,
	sanitizeSettings,
	selectedLeagues,
	SETTINGS_BOOKMAKERS,
	SETTINGS_LEAGUES,
	SETTINGS_MARKETS,
	settingsDiff,
	settingsWarnings,
	STAKE_UNITS,
	stakeOptions,
	STORAGE_LIMIT_BYTES
} from '@football/core';
export type {
	ISettings,
	ISettingsEstimate,
	ISettingsLeague,
	ISettingsMarket,
	ISettingsWarning,
	NumberField,
	Retention,
	SettingsMarketKey
} from '@football/core';

/** Megjelenés – téma-választó (DESIGN §3.1); a `ThemeStore.setPreference`-t hívja, nem része a piszkozatnak. */
export const THEME_OPTIONS: readonly { key: ThemePreference; label: string }[] = [
	{ key: 'system', label: 'Rendszer' },
	{ key: 'dark', label: 'Sötét' },
	{ key: 'light', label: 'Világos' }
];

/** A Beállítások szekciói (asztalon bal menü, mobilon chip-sor; anchor-célok). */
export const SETTINGS_SECTIONS = [
	{ id: 'ligak', label: 'Ligák' },
	{ id: 'piacok', label: 'Piacok és irodák' },
	{ id: 'tarolas', label: 'Tárolás' },
	{ id: 'strategia', label: 'Stratégia' },
	{ id: 'megjelenes', label: 'Megjelenés' }
] as const;

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id'];
