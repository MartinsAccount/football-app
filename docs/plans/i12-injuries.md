# I12 – `injuries` job (ROADMAP 3.6, mock)

**Cél:** a planner `injuries` feladata (`ids` ≤ 20 meccs, T−24 h, a core `planTasks` adja) → `/injuries?ids=a-b-c` → a sérültlista
a meccshez kötve az `injury_report` táblába (0002-es migráció, PK `fixture_id, player_id, captured_at`).

**Megoldás**

- `packages/server/src/injuries.ts`: `toInjuryRows` (csak a kért meccsek, hiányos id kimarad, meccs × játékos egyedi),
  `insertInjuries` (`captured_at = now`, `ON CONFLICT DO NOTHING`, FK-hiányos sor kimarad), `createInjuriesHandler` (1
  hívás/feladat; `parseResultIds(…, 'injuries')`).
- `ingestWorker.ts`: `injuries` handler a `createDbIngestWorker`-ben.
- `referenceMocks.ts`: `injuriesByIdsEnvelope`, `withInjuries` (csak mentett elemekből; ismeretlen köteg → `undefined` =
  `mock-missing`, nem üres lista), `loadIngestMocks` a `data/history/api-football/injuries-*.json` fájlokból (ma nincs).
- Teszt: `injuries.test.ts` friss memória-PGlite-on, kézi **szintetikus** (`SYNTHETIC`) sérült-elemekkel.

**Nem cél:** élő hívás, migráció, sérült-feature a modellben (7.1), lefedettség-jelző a UI-ban.
