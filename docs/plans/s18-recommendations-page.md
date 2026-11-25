# S18 – `/` Ajánlások oldal mentett adatból (ROADMAP 5.4)

## Cél

A `/` a minta-kártyák helyett valódi `elo-poisson@0.1.0` predikciókból épülő ajánlásokat mutat, a PRD 6. fejezet mezőivel, 0 külső
hívással.

## Adat

- Mentett „mai nap”: **2025-04-12 (szo) + 04-13 (vas)**, top 5 liga, 40 meccs a football-data CSV-ből (az ingyenes csomag nem ad
  aktuális szezont, ADR-0002). Virtuális „most”: 2025-04-12 09:00 (Budapest); odds-időbélyeg: 2025-04-11 16:00 (a CSV péntek
  délutáni letöltése, `OPENING_OFFSET_MS` helyett, mert az 36 óránál régebbi = blokkoló lenne).
- Generátor: `npm run recommendations -w @football/db` → `data/recommendations/recommendations-v0.json` (determinisztikus).
  Walk-forward az összes korábbi CSV-meccsen (Elo, tempó, forma, tabella, H2H), a nap meccseinek eredménye nem látszik.

## Mag (`packages/core/src/recommend/`)

- `blendProbabilities(pModel, pMarket, w)`: logit-súlyozás + renormálás (strategy.md §4.5); `w` alap 0,25 (DECISIONS).
- `evaluateMarket(...)`: kimenetenként EV a legjobb oddson, a §5 szabályai (EV ≥ 5%, eltérés ≥ 2 pp, odds 1,50–4,00, ≥ 5 iroda,
  nincs blokkoló figyelmeztetés) → jelölt vagy elutasítás oka.
- `pickRecommendation`: meccsenként max. 1 (legnagyobb EV).
- `dataWarnings` (odds kora > 12 h figyelmeztet, > 36 h blokkol; < 4 meccs a szezonban blokkol; < 4 H2H figyelmeztet) és
  `confidenceLevel` (eltérés + minta + frissesség).

## UI

- `recommendationsView.ts`: JSON → `ITip` (Date-ek), napra csoportosítás („Ma”, „Holnap”) a virtuális most-hoz.
- `ITip.reasons` (indoklás, PRD 6) és `stakeUnits` (flat 1 egység); a TipCard a lenyitott részben mutatja az indoklást.
- Banner: „Mentett adat: 2025. április 12.” + sérültlista hiánya; üres nap → EmptyState.

## Ellenőrzés

core unit-tesztek, frontend nézet-teszt, typecheck, screenshot 1440/390.
