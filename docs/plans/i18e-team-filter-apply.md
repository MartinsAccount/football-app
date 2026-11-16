# I18e – csapatszűrő alkalmazása (ROADMAP 2.3)

Cél: a `team_filter` (include/exclude) érvényesítése a gyűjtésben és az ajánlásban.

## Jelentés (I18c döntése szerint)

- **Kizár** (`exclude`): a csapat meccsei kimaradnak (bármelyik oldalon szerepel).
- **Csak** (`include`): abban a ligában, amelyben a csapat szerepel, csak az include-csapatok meccsei maradnak; a többi liga
  érintetlen. A csapat ligái: `season_team` ∪ a `fixture` tábla (hazai/vendég).
- Ütközés (egy meccs include- és exclude-csapattal): az exclude nyer.

## Hatókör (döntés: DECISIONS.md)

- Gyűjtés: a planner `odds_early` / `odds_late` / `injuries` feladatai csak a megengedett meccseket kapják; a liga-napra csak
  akkor jön odds-feladat, ha van megengedett meccs. A `standings`, `fixtures_window`, `results`, `reference` nem szűrődik.
- Predikció: a naplózás változatlan (minden kimenet), a kiszűrt meccsen nincs ajánlás (`is_recommendation = false`).

## Lépések

1. core `settings/teamFilter.ts`: `buildTeamFilterIndex(filters, memberships)`, `teamFilterAllows(fixture, index)` + teszt.
2. core `ingest/tasks.ts`: `PlannerFixture.homeTeamId/awayTeamId?`, `PlannerInput.teamFilter?` + teszt.
3. db `settings.ts`: `loadTeamFilterIndex()`; `ingestTasks.ts` `loadPlannerInput` betölti (csapat-id-k + index) + teszt.
4. server `predictions.ts`: a pick csak megengedett meccsen + PGlite-teszt.
