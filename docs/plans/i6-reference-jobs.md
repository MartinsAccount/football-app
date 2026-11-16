# I6 – `reference` jobok mock módban (ROADMAP 3.2)

**Cél:** a planner heti/havi `reference` feladatai (`teams` liga × szezon, `odds/bookmakers`, `odds/bets`) valódi handlert kapnak
a `createIngestWorker` `handlers` térképén, és törzsadatot töltenek – 0 élő hívással, csak upserttel.

**Fájlok**

- `packages/server/src/reference.ts` – leképezés (`toTeamRows`, `toNamedRows`, `toMarketRows`), SQL-upsertek (`team`,
  `season_team`, `bookmaker`, `market`), `createReferenceHandler(db)`. A `stored` (tárolási beállítás) nem íródik felül; a null
  mező nem törli a meglévőt; `market.code` csak akkor, ha más id nem foglalja (`UNIQUE`).
- `packages/server/src/referenceMocks.ts` – mock-térkép a mentett adatból: `/teams` ← `data/history/api-football/fixtures-*.json`
  csapatai, `/odds/bookmakers` + `/odds/bets` ← `backend/stores/*-odds.json`. Tiszta `buildReferenceMocks` + fs-olvasó
  `loadReferenceMocks(root)`.
- `ingestWorker.ts` – `createDbIngestWorker(db, { fixtures })`: alapból `reference` handler.
- `scripts/tick.ts`, `scripts/dev.ts` – a mock-térkép betöltése.
- `reference.test.ts` – friss memória-PGlite: kitöltött törzsadat, `stored` megmarad, 0 hívás; hiányzó mock → `failed`.

**`market.analyzed`:** igaz, ha az API bet-neve ismert `BETS_TYPES` piac (az app elemzi), különben hamis.

**Nem cél:** élő hívás (💸), törlés, a helyi `.data/pglite` már `done` `reference` kulcsainak újranyitása.
