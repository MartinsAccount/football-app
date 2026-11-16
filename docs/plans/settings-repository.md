# I2 – Beállítás-repository + tárolási feloldó (ROADMAP 2.1a)

Cél: a `followed_league`, `team_filter`, `setting` táblák (0005) és a `market.stored` / `bookmaker.stored` jelzők olvasása-írása
egy repositoryn át, és egy tiszta core-függvény, amely ligánként megmondja, mely piac × iroda kerül az `odds_quote`-ba
(architecture.md §4.1). Séma nem változik (nincs migráció).

## Fájlok

- `packages/core/src/storage/storedScope.ts` (+ teszt): `resolveStoredScope(leagueId, input)` →
  `{ followed, marketIds, bookmakerIds }`, `isQuoteStored(scope, marketId, bookmakerId)`, `resolveStoredScopes(input)` (összes
  követett liga). Szabály: nem követett / `enabled=false` liga → üres scope; `markets = null` → globális `market.stored`; különben
  a lista (piackód vagy id-szöveg) felülírja a globálisat, ismeretlen elem kimarad; iroda = `bookmaker.stored`.
- `packages/db/src/settings.ts` (+ PGlite-teszt): `SettingsRepository` interfész + `SqlSettingsRepository`. Követett liga: list /
  upsert / remove (egyedi); csapatszűrő: list / upsert / remove; `setting`: getAll / get / set (upsert, `updated_at = now()`);
  piac/iroda: list + `setMarketStored` / `setBookmakerStored`; `loadStoredScopeInput()` a core feloldóhoz.
- Exportok: core és db `index.ts`.

## Ellenőrzés

`npm run verify -w @football/core`, `npm run verify -w @football/db`, prettier.

## Nem része

API (`/api/settings`, I3), UI-átkötés, a `odds_quote` írás szűrése (ingestion, I5 / 4.x).
