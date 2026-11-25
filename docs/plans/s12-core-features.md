# S12 – Core: feature-ök (terv)

Cél: tiszta, pont-idejű (`asOf` előtti meccsekből számolt) feature-függvények a `packages/core/src/features/` alatt (strategy.md
§3, §3.1). I/O nincs; a bemenet egy minimális `PlayedMatch` lista (a DB `fixture` soraiból képezhető).

## Fájlok

- `features/types.ts` – `PlayedMatch` (id, kickoff ISO, homeTeamId, awayTeamId, homeGoals, awayGoals),
  `playedBefore(matches, asOf)`.
- `features/form.ts` – `teamForm(matches, teamId, asOf, {n=6, decay=0.8, venue})`: súlyozott pont/meccs, gólkülönbség, W/D/L sor
  (legfrissebb elöl). Ellenfél-erő korrekció (Elo-reziduum) S13-ban, ha az Elo kész.
- `features/homeAway.ts` – `homeAwaySplit` (hazai/vendég ppg, rúgott/kapott átlag) + `leagueHomeAdvantage` (gól- és pontelőny,
  hazai/döntetlen/vendég arány).
- `features/h2h.ts` – utolsó max. 6 egymás elleni meccs átlagos GK-ja a megadott csapat szemszögéből, shrinkage `n/(n+k)`, k=6.
- `features/standings.ts` – `deriveStandings(matches, asOf)` (4.3 `standing_derived` magja): pont, GK, rúgott, majd id szerint;
  `tablePosition(table, teamId)`: hely, ppg, pontrés a felette/alatta állóhoz.
- `features/season.ts` – `seasonPhase(progress)` → `eleje` ≤ 20%, `hajra` ≥ 80%, egyébként `kozepe`; `tableTier` (top4 / közép /
  alsó4); `totalRounds(teamCount) = 2(n−1)`.
- `features/motivation.ts` – §3.1: zónák (`cim`, `europa`, `kieses`), rés a zónahatárhoz, állapot `eldolt|elo|kritikus`, csak R ≤
  összes/2 esetén; a csapat motivációja a legerősebb zóna; `motivationDiff`.
- `features/matchFeatures.ts` – `buildMatchFeatures(fixture, history, opts)`: a fentiek egy objektumban (a `prediction.features`
  JSON-ba és az indoklásba).
- Tesztek: `form.test.ts` (forma + H2H + hazai/vendég), `standings.test.ts` (tabella + szezon + motiváció + aggregátor); segéd:
  `testMatches.ts`.

## Döntések

- Alap zónák, ha nincs `standings.description`: cím 1–1, Európa 1–4, kiesés az utolsó 3 (DECISIONS.md).
- Holtverseny a tabellán: pont → GK → rúgott gól → teamId (determinisztikus; H2H-tiebreak nincs, TODO(polish)).
