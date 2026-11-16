# I22 – Arbitrázs a DB odds-snapshotjaiból (ROADMAP 8.1)

Cél: a `GET /api/arbitrage` a tárolt `odds_snapshot` + `odds_quote` sorokból számoljon (core `scanMarket`), a beállított ligákra,
0 API-hívással. A drótforma (`ArbitrageResponse`) változatlan → web és mobil átírás nélkül megy.

## Lépések

1. `packages/server/src/arbitrage.ts` – `loadArbitrageSnapshot(db, { now, days })`:
   - meccsek: `status IN (NS, TBD)`, `now ≤ kickoff < now + days` (alap 10 nap), a bekapcsolt `followed_league` ligáiban (ha nincs
     követett liga: minden liga);
   - meccsenként a legutóbbi `captured_at ≤ now` snapshot, a quote-ok irodanévvel;
   - piacok: 1X2 (`market_id = 1`) és Gól 2,5 (`market_id = 5`, `line = 2.5`) – ugyanazok a kulcsok/címkék, mint a
     CSV-pillanatképben (`h2h`, `ou25`);
   - `Infinity` → `null` (drótforma); nincs meccs → `null`.
2. `snapshots.ts` – `withDbArbitrage(source, load)`: a DB-ből számolt pillanatkép az elsődleges; `null` esetén a mentett JSON (a
   helyi DB 2024-es adatán „most” nincs közelgő meccs, így a web/mobil továbbra is a mentett képet mutatja).
3. `dev.ts` bekötés, `index.ts` export.
4. Teszt: friss memória-PGlite (seed: liga, 3 meccs, 2 iroda, snapshotok) – arb/far sávok, ablak, követett liga,
   `captured_at ≤ now`, hiányos piac `sum: null`, fallback.

Router nem változik. `odds_best` (minden iroda) nem kerül be: a legjobb oddsnak lehet `null` irodája, és nem fogadható iroda is
lehet benne → TODO(polish), DECISIONS.
