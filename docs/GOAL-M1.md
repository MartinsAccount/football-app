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
- **Design tokenek** a `docs/fe/design-system.md` + `docs/design/*.png` alapján, egy helyen
  (CSS-változók + `tailwind.config.cjs` theme). Beégetett szín vagy méret nincs.
- Alapkomponensek: gomb, kártya, táblázat, badge, stat-csempe, üres és hibaállapot.
- A `docs/fe/ui-audit.md` P0/P1 tételei javítva.
- App shell + navigáció. Oldalak a PRD 5.8 szerint, mind fixture-adatból:
  - `/` ajánlások (a PRD 6. fejezet mezőivel, adatkor és figyelmeztetések);
  - meccs-részletek (feature-ök, modell vs. piac, odds-mozgás);
  - `/evaluation` (ROI, Brier, kalibráció, CLV a backtest-adatból);
  - `/settings` (ligák, piacok, irodák, becsült napi hívás és tárhely);
  - `/arbitrage` átalakítva az új core-ra és a designra;
  - `/odds` és `/fixtures` beolvasztva vagy átirányítva.
- Mobilon az ajánlások listája olvasható.

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
