# I15 – Kiértékelő job (ROADMAP 5.3)

**Cél:** a `results` job után a lezárt meccsek még ki nem értékelt `prediction` soraira `evaluation` sor (a meglévő 0004-es
sémában; migráció nem kell), a core `evaluation/` képleteivel.

## Lépések

1. `packages/server/src/evaluation.ts`
   - `buildEvaluationRows(candidates, closing)` (tiszta): csoport = futás × meccs × piac × vonal; kimenet-index a rendes
     játékidőből (`ft_*`, különben `goals_*`): 1X2 → `outcome1x2`, O/U → `overUnderOutcome`; PST/CANC/ABD → void. `settleBet`,
     `flatProfit(best_odd)`, a piac eloszlásának `brierScore`/`logLoss` a csoport minden során (hiányos eloszlás vagy void →
     `null`), `closingLineValue(best_odd, záró)`.
   - `evaluateFixtures(db, fixtureIds, { now })`: jelöltek (FT/AET/PEN vagy void státusz, még nincs `evaluation`), záró-közeli
     snapshot = a kezdés előtti utolsó `odds_snapshot`, záró odds = a tárolt quote-ok maximuma; beszúrás `jsonb_to_recordset` +
     `ON CONFLICT (prediction_id) DO NOTHING` (idempotens).
2. `results.ts`: a `standing_derived` után `evaluateFixtures` a lezárt/void meccsekre (`ctx.now`).
3. `predictions.ts`: `PREDICTION_MARKETS` export (a kimenet-sorrend közös).
4. Teszt (`evaluation.test.ts`, friss memória-PGlite): tiszta képletek; a results handler mock klienssel → FT win/loss + CLV, PST
   → void; a kezdés utáni snapshot nem záró; ismételt futás 0 új sor.

## Nem cél

Ázsiai vonalak (half_win/half_loss), olvasó API/dashboard (5.5), `odds_best` mint záró forrás.
