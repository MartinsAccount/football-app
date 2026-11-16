# I17 – Kiértékelő olvasó-API a DB-ből (ROADMAP 5.5, API-rész)

Cél: a `prediction` × `evaluation` táblákból egy összesítő végpont, amire a web/mobil Kiértékelés-oldal később (I17b) rákötődik. A
szelet >10 fájl lenne UI-val, ezért kettébontva: **I17 = API**, **I17b = web (+ mobil) bekötés**.

## Szeletek

1. **core** `evaluation/dbSummary.ts` (tiszta, teszttel): `EvaluationRecord` (egy kiértékelt predikció sora) →
   `summarizeEvaluations(records, { modelVersion? })`:
   - `predictions`: Brier/log-loss **csoportonként (futás × meccs × piac × vonal) EGY sorral** (I15: a csoport minden sorában
     ugyanaz az érték) – különben többszörösen számolna;
   - `calibration`: minden nem-void predikció (p_model, találat) → `calibrationBuckets`;
   - `bets`: csak `is_recommendation` sorok → `summarizeBets` (találat vs. várt, flat ROI, CLV);
   - `markets`: ugyanez piaconként; `modelVersions`: az elérhető verziók (szűrés előtt).
2. **server** `loadEvaluationRecords(db)` (`evaluation.ts`): egy JOIN (`evaluation`, `prediction`, `prediction_run`). Router:
   `GET /api/evaluation?model=<verzió>` – `deps.evaluations` hiányában 404 (mint a settings).
3. **contract**: `EvaluationSummaryResponse` (= core `EvaluationSummary`), `client.getEvaluation(model?)`.
4. `scripts/dev.ts` bekötés.

## Döntések (DECISIONS.md)

- Aggregálás a core-ban (JS), nem SQL-ben: egyfelhasználós adatméret, tesztelhető; TODO(polish) SQL-aggregálás, ha nagy.
- A mai backtest-pillanatkép (`/api/backtest`) marad; az I17b az oldalon a DB-nézetet teszi mellé, nem helyette.
