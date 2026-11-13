import { useColorScheme } from 'react-native';
import { rnTheme, type RnTheme } from '@football/theme';

/** Floodlight-téma a rendszer sötét/világos beállítása szerint (alapértelmezés: sötét, mint a weben). */
export const useRnTheme = (): RnTheme => rnTheme(useColorScheme() === 'light' ? 'light' : 'dark');
