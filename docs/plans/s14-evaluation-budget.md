# S14 – Core: kiértékelés + budget-becslés

Forrás: `strategy.md` §7.2–7.3, `api-football.md` §6, `architecture.md` §4 / §4.1. Tiszta függvények a `packages/core`-ban.

## `evaluation/evaluation.ts`

- Kimenetel: `isVoidStatus` (PST, CANC, ABD → void), `outcome1x2(hg, ag)` → 0/1/2, `overUnderOutcome(goals, line)` → 0 = Over, 1 =
  Under, `null` = push (egész vonal, void).
- `settleBet(selection, result)` → `win | loss | void`; `flatProfit(outcome, odds)` (win: `odd − 1`, loss: `−1`, void: 0).
- `brierScore(p, y)` = `Σ_k (p_k − y_k)²`; `logLoss(p, y)` = `−ln p_y` (ε-vágással).
- `closingLineValue(oddTaken, closingOdd)` = `taken / closing − 1`; nincs záró → `null`.
- `calibrationBuckets(points, width = 0.1)` → vödrönként `meanP`, `hitRate`, `count` (üres vödör kimarad).
- `summarizeBets(bets)` → n, win/loss/void, találati arány vs. várt (átlag p), profit, ROI, ROI standard hibája (`√(Σ(o−1))/n`
  közelítés helyett a minta szórása / √n), átlagos CLV (csak ahol van).
- `summarizeProbabilities(preds)` → n, átlag Brier, átlag log-loss.

## `budget/budget.ts`

- `estimateLeagueCallsPerRound({ fixturesPerRound=10, matchDaysPerRound=2.5, predictionCandidates=0, resultPasses=1 })` → tételes
  bontás (fixtures, standings, early odds `ceil(n/10)`, late odds = meccsnapok, injuries `ceil(n/20)`, results) + összeg.
- `estimateDailyCalls(leagues, { roundsPerWeek=1.3, sharedWeekly, peakDayShare=0.6, dailyLimit=100 })` → forduló/hét/nap átlag,
  csúcsnap, maradék, `overLimit`. Ellenőrzés: 5 liga ≈ §6.3 táblázat (napi ~8, csúcs ~25).
- `estimateOddsStorage({ fixturesPerSeason, snapshotsPerFixture, bookmakers, outcomes, bytesPerRow=150 })` → sorok, bájt, az 500
  MB-hoz mért arány. Ellenőrzés: 5 liga, 5 iroda, 7 kimenet, 2 snapshot ≈ 10–20 MB.
