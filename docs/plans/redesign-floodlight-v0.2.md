# Terv – „Floodlight v0.2” átalakítás

Forrás: `docs/design/floodlight-v0.2/` (README, `design/DESIGN.md`, `CHANGES.md`, `screens/`, `reference/`).
Állapot: **jóváhagyásra vár** (0. lépés). Egy szelet = egy commit. Minden szelet után a tulajdonos dönti el, hogy jöhet-e a következő.

## Felderítés – kiinduló állapot

| Terület | Most |
|---|---|
| Build / teszt | Vite + Vitest (jsdom, Testing Library), `tsc --noEmit`, `npm run verify`; a `@football/core` Vitesttel tesztelt |
| Router | react-router-dom v5, `Main.tsx`: `/`, `/evaluation`, `/settings`, `/arbitrage` (`/odds`, `/fixtures` → `/`) |
| State | MobX v5 decorátorok: `MainStore` → `SlipStore`, `SettingsStore` (+ a legacy store-ok); az oldalak pillanatkép-JSON-ból töltődnek (0 hívás) |
| Styling | Floodlight **v0.1**: `src/design/tokens/*` (generált) + `components.css` (oe-*), mellette Tailwind (31 fájl, a `tailwind.config.cjs` színei `var(--…)`) |
| Téma | csak sötét; nincs `data-theme`, nincs váltó |
| Nyers szín | `src/`-ben **0 találat** a CHANGES 0. grep-jére (csak az `index.html` `theme-color` metája) |
| Screenshot | headless Edge (`msedge --headless=new --screenshot`); a Playwright MCP ebben a sessionben nem csatlakozott |

**v0.1 → v0.2 különbség:** a v0.2 `components.css` nem tartalmazza ezeket a ma használt osztályokat: `oe-card*`, `oe-card-grid`,
`oe-stat*`, `oe-prob*`, `oe-sheet*`, `oe-slipbar*`, `oe-slip--desktop`, `oe-slip__note`, `oe-status`, `oe-banner`, `oe-input`,
`oe-btn--toggle/--light`, `oe-badge--accent`, `oe-warning--box/--danger`, `oe-presets`, `oe-preset__head/__stats`, `oe-details__legend`.
Kikerülő tokenek: `--font-size-display`, `--font-size-h2`, `--radius-sheet`, `--size-card-min`, `--size-control-lg`,
`--space-18`, `--color-bg-info`, `--color-border-info`, `--color-warning-surface-*`, `--color-accent-alt-amber`.
A `CalibrationChart` a `size.card-min` tokent használja, a Tailwind config pedig a `font-size-display/h2` és a `radius-sheet` tokent.

## Döntések (a „választhatsz” pontokra)

- **Styling:** a téma alapja a `tokens.css` (CSS-változók `:root`-on és `[data-theme="light"]`-en). A Tailwind theme ezekre
  a változókra mutat (S02 óta), így a Tailwind-osztályok is követik a témát. A csomag `components.css`-e változatlanul,
  „vendor” fájlként kerül be, és a referencia oe-* osztályait közvetlenül használjuk. Az elrendezés és a csomagban nem
  szereplő, appsaját elemek (mobil alsó lap, szelvény-sáv stb.) **Tailwind utilityvel, tokenekből** készülnek; új saját
  CSS-fájl nem lesz. Ezt egy ADR rögzíti (az ADR-0001 kiegészítése: Tailwind + Floodlight komponens-CSS).
- A téma-preferencia egy kis `ThemeStore`-ban (MobX) él, a `MainStore` alatt. Kulcs: `THEME_STORAGE_KEY`; értéke
  `system | dark | light`. A fejléc-váltó és a Beállítások ugyanezt a store-t állítja. Az inline script a
  `?theme=light|dark` paramétert is elfogadja (a referenciával egyezően); ez kell a headless screenshotokhoz.
- Az új tiszta logika a `packages/core`-ba kerül (tesztekkel). A `frontend/*View.ts` csak formáz és leképez.

## Referencia-blokk → komponens leképezés

| Referencia (osztály) | Fájl | Művelet |
|---|---|---|
| `.oe-header`, `.oe-brand`, `.oe-nav`, `.oe-status-pill`, `.oe-theme-toggle` | `components/AppShell/AppHeader.tsx` | módosít (`oe-status` → `oe-status-pill`, `data-state`: `saved`/`live`), + `ThemeToggle.tsx` (új) |
| `.oe-page-head`, `.oe-page-title`, `.oe-meta-chip` | `components/PageIntro/PageHead.tsx` (új) | új; az Értékelés, az Arbitrázs és a Beállítások erre vált |
| `.oe-hero`, `.oe-h1` + adat-állapot sor (`.oe-pill--warning`, `.oe-linkbtn`, `.oe-datastate__detail`) | `components/PageIntro/PageIntro.tsx`, `DataState.tsx` (új) | a Ma oldal fejléce; az `EngineBanner` nagy doboza megszűnik |
| `.oe-tip` (head, `.oe-tip__ev`, `.oe-decision`/`.oe-tile`, `.oe-pbar`, `.oe-why__chips`, `.oe-teams`, `.oe-warning`, `.oe-tip__actions`) | `components/TipCard/TipCard.tsx`, `TeamForm.tsx`, `TipActions.tsx`, `Disclosure.tsx`; `ProbabilityBars.tsx` → `ProbabilityTile.tsx` | átírás a referencia szerkezetére |
| `.oe-tip__details` (`.oe-reasons`, `.oe-details`, `.oe-strip`, `.oe-standing`, `.oe-row--h2h`, `.oe-row`, `.oe-tip__source`) | `components/MatchDetails/*` | osztálycsere; a forrás-sor ide kerül át |
| `.oe-slip` üres állapot + `.oe-preset`, `.oe-risk-dot` | `components/SlipPanel/SlipPanel.tsx`, `components/SlipPresets/SlipPresets.tsx` | a presetek a panel üres állapotába kerülnek, a lista feletti blokk megszűnik |
| `.oe-slip` kitöltve (`.oe-slip__leg`, csempék, `.oe-risk__fill`, `.oe-stake`, CTA, `.oe-linkbtn--muted`) | `SlipLegs`, `SlipTotals`, `RiskMeter`, `StakeSelector`, `TippmixTransfer` | osztálycsere; sticky az `.oe-split`-ben |
| `.oe-verdict`, `.oe-table` (sikermutatók, pontosság), `.oe-goal-pill`, `.oe-delta` | `pages/EvaluationPage/EvaluationPage.tsx` + `Verdict.tsx`, `GoalsTable.tsx`, `AccuracyTable.tsx` (új) | átrendezés |
| `.oe-kpis`, `.oe-kpi`, `.oe-compare`, `.oe-ci` | `pages/EvaluationPage/KpiRow.tsx` (új) | a `betTiles` helyett |
| `.oe-calib`, `.oe-chart*`, `.oe-calib-row`, `.oe-dev` | `CalibrationChart.tsx` (átírás HTML+SVG `.oe-chart` szerkezetre), `CalibrationTable.tsx` (új) | |
| Arbitrázs-kártyák, szűrő `.oe-segmented` | `pages/ArbitragePage/ArbitragePage.tsx`, `ArbitrageCard.tsx`, `arbitrageView.ts` | szövegek, pill, címke-javítás |
| Beállítások (szekció-menü, liga-kártya, Megjelenés, mentés-sáv) | `pages/SettingsPage/SettingsPage.tsx` + `SettingsNav.tsx`, `SaveBar.tsx` (új) | átrendezés |

## Szeletek

**S25 – Tokenek és téma** (CHANGES 0.)
Érintett fájlok: `src/design/tokens/{tokens.json,tokens.light.json,build-tokens.mjs}` (csere), a generált `tokens.css/ts`,
`src/design/components/components.css` (csere), ADR (Tailwind + Floodlight CSS), `src/design/DESIGN.md` (csere),
`index.html` (inline script), `index.tsx`, `tailwind.config.cjs`, `stores/ThemeStore.ts` + teszt (új), `MainStore.ts`,
`AppShell/ThemeToggle.tsx` (új), `AppHeader.tsx`, `CalibrationChart.tsx` (kikerült token).
Ellenőrzés: a grep szerint nincs nyers szín; a váltás után az állapot újratöltéskor is megmarad; screenshot minden route-ról
(4 oldal × 2 téma × 2 szélesség).

**S26 – Közös keret** (CHANGES 1.)
Érintett fájlok: `AppHeader.tsx`, `PageIntro/PageHead.tsx` (új), `EvaluationPage.tsx`, `ArbitragePage.tsx`, `SettingsPage.tsx`
(csak a fej), és a kiválasztás-stílusok (`aria-pressed`, semleges) mindenhol.

**S27 – Ma oldal** (CHANGES 2.)
Core: `slip/presets.ts` a §8.2 szerint (max. 3; a szingli „Ajánlott”, ha a kockázata low/medium; a dupla a két legjobb EV-jű,
különböző meccsekről), `slip/slip.ts` + `oneInText(p)` („kb. minden kilencedik”, sorszámnévvel), tesztek
(3,00 × 1 000 Ft → 3 000 Ft; 3,00 × 3,23 → 9,69, 12%, „kilencedik”).
Frontend: `RecommendationsPage.tsx`, `DataState.tsx`, a TipCard-, MatchDetails-, SlipPanel- és SlipPresets-fájlok,
`recommendationsView.ts` (adat-állapot chipek a pillanatképből).
Ha 10 fájlnál több változik, két részre bontom: **S27a** a kártya, **S27b** a szelvény és a presetek.

**S28 – Kiértékelés** (CHANGES 3.)
Core: `evaluation/goals.ts` (5 PRD-cél: státusz `ok | fail | info`; a ROI 300 tipp alatt `info`), `evaluation/verdict.ts`
(tónus a §8.3 szerint, cím és 1–2 mondat számokkal), `roiInterval(roi, se)`, valamint a kalibrációs pont mérete és a
„kiemelendő” / „kis minta” jelzők. Teszt: a mostani backtest-számokkal az eredmény `negative`, 2/5 teljesül.
Frontend: `EvaluationPage.tsx`, `evaluationView.ts` (a `verdict` és a `betTiles` átköltözik a core-ba), és az új
`Verdict`, `GoalsTable`, `KpiRow`, `AccuracyTable`, `CalibrationChart`, `CalibrationTable` komponens.

**S29 – Arbitrázs** (CHANGES 4.)
Core: `arbitrage/scan.ts` + `roundedBand(odds, total, round)`: „arb” csak akkor, ha a kerekített tétekkel számolt
`worstPayout ≥ staked`, különben „near”. Teszt: Σ < 1, de a kerekítés után negatív kifizetés esetén nem „arb”.
Frontend: `arbitrageView.ts` (a kártya címkéje és a számlálók ebből jönnek, a „garantált” szó megszűnik), `ArbitragePage.tsx`
(alcím-chip, `.oe-pill--warning` a történeti adatról), és az `arbitrageView.test.ts` frissítése.

**S30 – Beállítások** (CHANGES 5.)
Érintett fájlok: `SettingsPage.tsx`, `SettingsNav.tsx`, `SaveBar.tsx` (új), `settingsView.ts` (`missingCoverage`,
`settingsDiff` → „17 → 21”, tesztekkel), `SettingsStore.ts` (piszkozat és mentett állapot: Elvetés / Mentés).
A Megjelenés szekció a `ThemeStore`-t állítja.

Minden szeletnél kész feltétel: `npm run verify` zöld, és 16 (vagy a szelet által érintett) screenshot készül
a `docs/plans/screens/<szelet>-<oldal>-<téma>-<szélesség>.png` mintára (headless Edge, `?theme=`). Ellenőrizni kell,
hogy `scrollWidth ≤ viewport`, és hogy nincs konzolhiba. Végül összevetés a csomag `screens/` képeivel, és frissül a `STATE.md`.

## Hiányzó adat (ezeket a blokkokat elrejtem, és jelentem)

1. **„Miért?” csipek pp-értékkel, kimenetre szűrve:** a pillanatképben csak az indoklás szövege van (`reasons: string[]`).
   A strukturált `FactorContribution {factor, deltaPp}` a core modellben megvan, de a `recommendations-v0.json` nem menti.
   → A csip-sort elrejtem, a teljes indoklás a lenyitott részben marad. (A szöveg regexszel való parszolását elvetettem.)
2. **Tabella-zónák** (BL / EK / kiesés): ma fix sávok (1–4 / 5–6 / utolsó 3), nem adatból jönnek. → A sáv csak a két csapat
   helyezését mutatja zóna-színezés és jelmagyarázat nélkül, amíg a `standings.description` nincs a forrásban.
3. **„Sérültlista nincs a forrásban” chip:** a pillanatképben nincs strukturált lefedettség-jelző. → Csak akkor jelenik
   meg, ha a `warnings` vagy a `source` ezt tartalmazza; különben elrejtem.
4. **Kalibráció szegmensenként:** a backtest csak piaconként ad kalibrációt (`calibration.h2h/ou25`), szezonra vagy ligára
   nem. → Szegmens választásakor a kalibrációs blokkon „minden szezon és liga” chip jelzi, hogy összesített adat.
5. **PRD 9 baseline-sor** („saját modell vs. API `/predictions`”): nincs ilyen adat. → Nem kerül a sikermutatók közé
   (a DESIGN §8.4 is csak 5 célt sorol fel).
6. **Liga-coverage a Beállításokban:** ma kézi katalógus (`settingsView.ts`), nem a `/leagues` válaszából jön. Csak a
   megjelenítés változik; az adat forrása marad, és jelzem.

Ami megvan, és felhasználom: H2H, utolsó 5, helyezés, pont, gólkülönbség, `stake` (tét-szöveg), `oddsAt`, iroda,
`pMarket`, `minOdds`, a ROI szórása (`roiStdError` → 95% = ±1,96 SE), CLV, a kalibrációs vödrök `count` mezővel,
valamint a pontosság (modell / nyitó / záró).

## Kockázatok

- **Osztálynév-törés:** a v0.2 CSS cseréje után a még át nem írt komponensek stílus nélkül maradhatnak. Az S25 a kieső
  osztályokat használó komponenseket Tailwind-utilityre (tokenekből) írja át; minden route-ról screenshot készül.
- **Tailwind ↔ oe-* ütközés** (preflight, specificitás). A komponensekben az oe-* osztály a fő stílus, a Tailwind csak
  elrendezésre marad.
- **MobX v5 és class komponensek:** a téma-store `@observable`, a `data-theme` írása a `document.documentElement`-re
  `reaction` segítségével történik, így a React-fán kívül.
- **Villanás:** a Vite dev módban a CSS JS-ből töltődik be. Az inline script ettől függetlenül időben beállítja a
  `data-theme`-et, a `tokens.css` pedig a rendszer-témát is lefedi.
- **Screenshot:** headless Edge-dzsel CDP-kattintás nélkül a kitöltött szelvényt nehéz lefotózni (az S19-ben CDP-vel
  ment). Ha nem megy, a kitöltött állapotot unit/DOM-teszt fedi, és a hiányt jelzem.

## Nyitott kérdések a tulajdonosnak

1. **„Miért?” csipek:** bővíthetem-e a `recommendations-v0.json` generátorát (`packages/db`, `npm run recommendations`)
   egy `factors: {factor, outcome, deltaPp, text}[]` mezővel? Ez a már meglévő core-kimenetet menti el, a modell nem
   változik, de technikailag a pillanatkép-előállítás módosítása. **Alapértelmezés: nem, a csipek rejtve maradnak.**
2. **Tabella-zónák:** maradjon-e a mai fix zónázás (mint eddig), vagy rejtsem el, amíg nincs valódi adat?
   **Alapértelmezés: elrejtem** (a „ne találj ki adatot” szabály szerint).
3. A v0.1 `src/design/components/components.html` és `src/design/README.md` elavul. Javaslat: a v0.2 `reference/*.html`
   kerüljön a helyükre (`src/design/reference/`), a `CLAUDE.md` hivatkozásával együtt.
