# I10 – ROADMAP 3.5 `odds_early` + `odds_late` snapshot (mock)

**Cél:** a planner odds-feladatai (`{ league, season, date, fixtures }`, kezdés −48…−24 h, ill. −3 h…kezdés) → lapozott
`/odds?league&season&date&page` (10 meccs/oldal, `getAllPages`) → `odds_snapshot` + `odds_quote` (csak insert). 0 élő hívás.

## Szeletek / fájlok

1. `packages/server/src/odds.ts`: API-alak → `OddsSnapshotInput[]` (tiszta): csak a feladat meccsei, csak a tárolási kör
   (`resolveStoredScope` + `isQuoteStored`, bemenet: `SqlSettingsRepository.loadStoredScopeInput`), `parseSelection` (vonal),
   `odd > 1`, kulcs-dedupe; `provider_updated_at` = az item `update`-je; `captured_at` = a futás ideje; `kind` = early/late.
   Handler: `getAllPages` (maxPages = ⌈n/10⌉, a planner becslése), mentés `SqlRepository.insertOddsSnapshots`.
2. `referenceMocks.ts`: `withOdds` Proxy a `/odds?date&league&season[&page]` kulcsra: a mentett meccsek közül az adott napon
   játszottak (a DB-be is ezek kerülnek), a mentett `backend/stores/*-odds.json` azonos ligájú irodablokkjai ciklikusan
   ráképezve (a mentett odds 2021-es, más meccsekre szól – DECISIONS), 10/oldal. `loadIngestMocks` bekötése.
3. `ingestWorker.ts` (két handler), `index.ts` export, `scripts/tick.ts` komment.
4. `odds.test.ts`: leképezés (szűrés, vonal, dedupe), mock-lapozás (>10 meccs), worker friss memória-PGlite-on: early, majd
   late snapshot, csak a stored piac × iroda; ismételt tick nem duplikál.

## Nem cél / polish

- `odds_best` (a teljes válaszból számolt legjobb/átlag) – TODO(polish), külön szelet.
- Üres (0 tárolt quote-os) snapshot nem íródik.
