# S22 – `/settings` (PRD 5.3, 5.8; GOAL-M1 §3)

## Cél

Ligák, piacok, irodák, snapshot-megőrzés és a stratégia-paraméterek (EV-küszöb, min./max. odds, alapegység, backfill-tartalék)
beállítása; az oldal élőben mutatja a becsült napi hívást (átlag, csúcsnap, tartalék) és a becsült tárhelyet szezononként, és
figyelmeztet, ha a 100/nap vagy az 500 MB nem elég (PRD 7.5).

## Fájlok

- `frontend/src/pages/SettingsPage/settingsView.ts` (+ teszt): katalógus (`SETTINGS_LEAGUES`, `SETTINGS_MARKETS`,
  `SETTINGS_BOOKMAKERS`), `ISettings` + `DEFAULT_SETTINGS`, `sanitizeSettings`, `parseDecimalInput`, `estimateSettings` (core
  `estimateDailyCalls` + `estimateOddsStorage`), `settingsWarnings`, `stakeOptions`.
- `frontend/src/stores/SettingsStore.ts` (+ teszt): MobX v5, localStorage `oe_settings` (tároló-interfész, mint a SlipStore).
- `MainStore`: `SettingsStore` + a `SlipStore` a tét-lépcsőt a beállítás alapegységéből kapja.
- `SettingsPage.tsx`: összegző csempék + figyelmeztetés, ligák (lefedettség, hívás/nap), piacok, irodák, megőrzés, stratégia.
- `SlipPanel`: `store.stakeOptions`.

## Döntések

- Tárolás most localStorage; a DB `setting` táblába írás a backend-íróval (5.x) jön → DECISIONS.md.
- Liga-katalógus statikus (top 5 + 4 bővítési jelölt), a `coverage` flagek kézzel; később a `/leagues` válaszából.
- Megőrzés: „nyitó + záró” = 2 snapshot/meccs, „minden snapshot” ≈ 1 korai + 2,5 késői + záró ≈ 4,5.
- A beállítás még nem hat a motorra (a `/` pillanatkép előre számolt) → TODO(polish), STATE.md.
