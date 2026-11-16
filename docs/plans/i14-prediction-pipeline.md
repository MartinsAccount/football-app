# I14 – Predikció-pipeline (ROADMAP 5.2)

**Cél:** az odds-snapshot után (`derive`) a feladat meccseire `elo-poisson@0.1.0` predikció → `model_version`,
`prediction_run`, `prediction` (append-only). Séma kész (0004), migráció nem kell. Modell-logika változatlan.

**Fájlok:** `packages/server/src/predictions.ts` (+ teszt), `ingestWorker.ts` (bekötés), `index.ts` (export),
`vitest.config.ts` (timeout), docs (STATE, ROADMAP, DECISIONS).

**Lépések (`runPredictions(db, fixtureIds, { now })`):**
1. Célmeccsek: a lista `NS`/`TBD` meccsei, kezdés > `now`.
2. Történet: minden befejezett (FT/AET/PEN) meccs, kezdés < `now` (pont-idejű); liga- és szezonszűrés a feature-ökhöz.
3. Odds: a meccs legutóbbi snapshotja (`captured_at ≤ now`), `odds_quote` irodánként; piacok: 1 (1X2), 5 (O/U 2.5).
4. Tabella: `standing_derived` utolsó `as_of`-ja ≤ a meccsnap UTC-éjfele (adatminőség: lejátszott meccsszám).
5. Core: `eloPoissonPrediction`, `buildMatchFeatures`, `dataWarnings`, `evaluateMarket` + `pickRecommendation`,
   kimenetenként `consensusFairProbabilities` / `blendProbabilities` / `bestOdds`, `confidenceLevel`.
6. Írás: `model_version` upsert (DO NOTHING), majd egy CTE-utasítás: `prediction_run` + összes `prediction` sor
   (`jsonb_to_recordset`). Nincs sor → nincs run.
7. Bekötés: `withPredictions(db, createOddsHandler(...))` az `odds_early`/`odds_late` kindra (0 hívás).

**Teszt (memória-PGlite, mentett PL 2024):** két futás = két run, a régi sorok bájtra azonosak, UPDATE/DELETE tilos;
Σp = 1 piaconként, legjobb odds + iroda, feature-snapshot a derived tabellával, ≤ 1 ajánlás/meccs; worker-bekötés mock oddsszal.
