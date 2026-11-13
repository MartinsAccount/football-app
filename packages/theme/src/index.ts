import { rnThemes } from './theme.generated';

export { rnThemes, tokenPaths } from './theme.generated';

/** A téma neve – megegyezik a core `ThemeName`-jével (a theme csomag szándékosan függőség nélküli). */
export type RnThemeName = keyof typeof rnThemes;
/** Egy feloldott RN-téma alakja (a sötét és a világos ugyanazokat a kulcsokat adja). */
export type RnTheme = (typeof rnThemes)[RnThemeName];

/** A megadott téma feloldott értékei React Nativehoz. */
export const rnTheme = (name: RnThemeName): RnTheme => rnThemes[name];
