# Cél: M1 – „Az app végigkattintható, mentett adatból”

> Autonóm futás célja. Minden session a docs/STATE.md után ezt olvassa el.
> Szeletek forrása: ROADMAP.md. Ez a fájl csak azt mondja meg, **meddig** menj és **mi a kész**.

## Kiindulás (2026-11-12)
- 0. fázis kész: 0.3, 0.4, 0.6, 0.7, 0.8.
- Nyitott: **0.5 mock/fixture mód**.
- `CURRENT_SEASON = 2024` (ADR-0002). A fejlesztés mentett 2022–2024 adatból megy.

## Végállapot (ha mind teljesül → írd a STATE.md-be: `ALL_DONE M1`)

### 1. Adat és háttér
- **0.5 kész:** az app és minden teszt élő hívás nélkül fut, fixture-adatból, egy kapcsolóval
  (pl. `DATA_MODE=fixture|live`).
- **DB-séma:** SQL-migrációs fájlok, Supabase/Postgres-kompatibilisek.
  - Táblák: ligák, csapatok, meccsek, tabella-snapshot, odds-snapshot, predikció (append-only),
    kiértékelés, hívásnapló, beállítások.
  - Repository-interfész + **fixture/in-memory adapter**, tesztekkel.
  - Ha a `.env`-ben nincs Supabase-adat, a valódi bekötés a BLOCKERS.md-be kerül, és nem vár rá.
- **Import:** a régi JSON-ok importáló scriptje az adapteren keresztül. Idempotens.
- **Backend-proxy:** az API-kulcs csak szerveroldalon van, és van napi hívásszámláló, amely a
  100-at soha nem lépi túl.

### 2. Mag (`packages/core`, tiszta függvények, unit tesztekkel)
- Fair valószínűség, EV, minimális vállalható odds.
- Budget-becslés ligánként.
- Feature-ök: forma, hazai/vendég, H2H, tabellahely, szezonszakasz, motiváció/tét.
- **Modell v0** (pl. `elo-poisson@0.1.0`): 1X2 és O/U 2.5 valószínűség + indoklás (a fő tényezők
  hozzájárulása).
- Kiértékelés: találat, flat profit, Brier, log-loss, CLV, kalibrációs vödrök.
- **Backtest-futtató** 2022–2024 fixture-adaton, a piaci baseline-nal összevetve.
  Az eredmény a `docs/analysis/backtest-v0.md`-be kerül.

### 3. Design és UI
Forrás: **`frontend/src/design/DESIGN.md`** (Floodlight). Csak a releváns fejezetet olvasd.
A `docs/design/*.png` régi tervek; ütközéskor a DESIGN.md nyer. Ha a DESIGN.md és a PRD
ütközik, a **PRD nyer**, és az eltérés a `docs/DECISIONS.md`-be kerül.

**Útvonalak**
- `frontend/src/design/tokens/tokens.json`: a tokenek egyetlen forrása. Generált:
  `tokens.css` (`:root` változók) és `tokens.ts` (`tokens`, `cssVar`, `v()`), kézzel nem szerkeszted.
- `frontend/src/design/components/components.css`: `oe-*` komponens-osztályok;
  `components.html`: élő kinézet-referencia.
- Bekötés: a belépési pont importálja a `tokens.css`-t és a `components.css`-t.
- `npm run tokens` script (`node src/design/tokens/build-tokens.mjs`), ami a `dev` és a
  `build` előtt is lefut (`predev` / `prebuild`).
- A `tailwind.config.cjs` theme a CSS-változókra hivatkozik (`var(--color-…)`, `var(--space-…)`),
  nem nyers értékre. Beégetett szín vagy méret nincs.

**Tiszta mag (`packages/core`, unit tesztekkel)** – DESIGN.md §9:
- EV, edge (pp), min. odds (`(1/p_modell) × (1 + EV-küszöb)`, küszöb alapból 5%), kötés eredő
  odds / esélye / EV-je / min. oddsa, szingli-összevetés, nyeremény, kockázat (low/medium/high).
- Ugyanarról a meccsről két tipp nem kerülhet egy szelvényre (a mag ellenőrzi).
- Magyar számformázás egy közös `format.ts`-ben (DESIGN.md §8, `Intl.NumberFormat('hu-HU')`):
  odds, %, pp, EV, Ft, egység, időpont, dátum. A komponens sosem hív `toFixed`-et.

**Komponensek** (DESIGN.md §7, fa: §13): **AppShell** (AppHeader + tartalom), **TipCard**
(TeamForm, ProbabilityBars, TipActions, Disclosure), **MatchDetails** (LeagueStrip, H2HList,
RecentList), **SlipPanel** (SlipLegs, SlipTotals, RiskMeter, StakeSelector),
**TippmixTransfer**, **SlipPresets**, mobilon **SlipBar** + **BottomSheet**. Mellettük
PageIntro (ModeSwitch), EngineBanner. Store: `SlipStore` (MobX v5), a képletek a magból jönnek.

**Szelvény** = a PRD 7. fejezet 3. pontja (fogadás rögzítése): csak helyi számolás, beírt
Tippmix-odds és tét mentése, **automatikus fogadásleadás nincs** (PRD 8. nem-cél).

**Oldalak** a PRD 5.8 szerint, mind fixture-adatból:
  - `/` ajánlások TipCard-okkal + SlipPanel (a PRD 6. fejezet mezőivel, adatkor és figyelmeztetések);
  - meccs-részletek a TipCard lenyitott MatchDetails részében (forma, tabella, H2H; később odds-mozgás);
  - `/evaluation` (ROI, Brier, kalibráció, CLV a backtest-adatból);
  - `/settings` (ligák, piacok, irodák, becsült napi hívás és tárhely);
  - `/arbitrage` átalakítva az új core-ra és a designra;
  - `/odds` és `/fixtures` beolvasztva vagy átirányítva.
- A `docs/fe/ui-audit.md` P0/P1 tételei javítva.

**Kész-feltétel (UI):** screenshot a futó appról **1440 és 390 px** szélességen, vízszintes
görgetés nélkül, a konzolban nincs hiba.

### 4. Minőségkapu (minden szelet végén)
- `npm run verify` zöld.
- UI-szeletnél headless screenshot az érintett route-ról, és a konzolban nincs hiba.

## Nem része az M1-nek (ne kezdd el)
- Éles Vercel-deploy, Supabase-projekt létrehozása, cron élesítése, hozzáférés-védelem élesítése
  (ezek a BLOCKERS.md-be kerülnek, a kód előkészíthető).
- API-kulcsok rotálása és `.env` módosítása (a tulajdonos dolga).
- Fizetős csomag, aktuális szezon adatforrása (D1 szerint később, új ADR).
- PRD 8. fejezet nem-céljai.

## Leállási feltételek
- `ALL_DONE M1`, vagy
- 3 egymást követő szelet blokkolt, vagy
- a maradék szeletek mind blokkoltak.

Leállás előtt a STATE.md „Jegyzet a következő sessionnek” részébe kerüljön egy rövid
összefoglaló: mi kész, mi blokkolt, mit kell a tulajdonosnak eldöntenie.
