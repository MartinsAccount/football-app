import { useColorScheme } from 'react-native';
import { effectiveTheme, type ThemeName } from '@football/core';
import { rnTheme, type RnTheme } from '@football/theme';
import { usePreferences } from '@/lib/preferences';

/** A megjelenített téma: a mentett preferencia (`oe-theme`), „Rendszer” esetén a készülék beállítása (alap: sötét). */
export const useThemeName = (): ThemeName => effectiveTheme(usePreferences().themePreference, useColorScheme() === 'light');

/** Floodlight-téma a megjelenített téma szerint. */
export const useRnTheme = (): RnTheme => rnTheme(useThemeName());
