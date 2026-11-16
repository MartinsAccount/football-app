# M9 – Mobil Beállítások (ROADMAP 11.7)

Cél: az Expo-appban a web `/settings` mentett beállításai (`settingsCodec`, `oe_settings`) és a téma-preferencia (`themeCodec`,
`oe-theme`) AsyncStorage-ban, a core-ra építve; a Szelvény tét-lépcsője a mentett alapegységből.

## Döntések

- Új route `preferences.tsx` („Beállítások”); a meglévő `settings.tsx` marad „Kapcsolat” (secure store), a Beállítások aljáról
  linkkel érhető el. A fejléc „Beállítások” linkje a `/preferences`-re mutat.
- Közös állapot: `src/lib/preferences.tsx` React-context (`PreferencesProvider` a `_layout`-ban): `settings`, `saveSettings`,
  `themePreference`, `setThemePreference`. Store-könyvtár nincs (a mobil eddig is komponens-state).
- Téma: `useRnTheme` = `effectiveTheme(preference, useColorScheme() === 'light')`; a preferencia azonnal hat és ment (mint a
  weben), a többi beállítás piszkozat → Mentés / Elvetés.
- Core: a web store privát `toggle`/`setNumber` logikája tiszta függvény lesz (`toggleSettingsItem`, `withSettingsNumber`),
  teszttel; a web store-hoz nem nyúlok (külön polish).

## Képernyő

Megjelenés (Rendszer/Sötét/Világos) · Tét alapegység (`STAKE_UNITS`, lépcső-előnézet `stakeOptions`) · Value-szűrő (EV-küszöb %,
min./max. odds; `parseNumberField`, hibás bevitelnél jelzés) · Ligák (+ `missingCoverage`) · Piacok · Irodák · Odds-tárolás ·
Backfill-tartalék · Becslés (`estimateSettings`: napi hívás tartalékkal, csúcsnap, tárhely/szezon) + `settingsWarnings` ·
Mentés/Elvetés/Alapértékek · Kapcsolat-link.

## Szelvény

`stakeOptions(settings.stakeUnit)`; kezdő tét = alapegység; egységváltáskor visszaáll az alapegységre.

## Ellenőrzés

core tesztek (settings), `tsc` mobil + frontend, prettier az érintett fájlokra, `expo export --platform android`.
