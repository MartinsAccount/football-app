# S03 – Core: format.ts + odds-matek

Cél: a DESIGN.md §8 formázás és §9 / ROADMAP 5.1 piaci képletek tiszta függvényként a `packages/core`-ban.

## Fájlok

- `src/format/format.ts` (+ teszt): `formatOdds`, `formatPercent`, `formatPp`, `formatEv`, `formatFt`, `formatUnits`,
  `formatKickoff`, `formatYearMonth`, `formatScore`, `formatPairing`, `formatAge`.
  - Ezres elválasztó: U+00A0, kézzel csoportosítva (a hu-HU Intl 4 jegyűt nem csoportosít: `3096`).
  - Negatív előjel: valódi mínuszjel `−` (U+2212).
  - Időzóna: alapból `Europe/Budapest`, paraméterezhető → determinisztikus teszt.
- `src/model/market.ts` (+ teszt): `impliedProbabilities`, `overround`, `fairProbabilities` (arányos margin-mentesítés),
  `consensusFairProbabilities` (irodánkénti fair p átlaga, újranormálva), `bestOdds` (kimenetenként max + iroda indexe).
- `src/odds/value.ts` (+ teszt): `expectedValue`, `edgePp`, `minOdds` (küszöb alapból 5%).
- `src/index.ts`: export.

## Döntés

- Margin-mentesítés: arányos (normalizálás). Shin/power később, ha a backtest indokolja.
