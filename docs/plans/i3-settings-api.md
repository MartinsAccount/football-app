# I3 – Beállítás-API (ROADMAP 2.1b)

Cél: `GET/PUT /api/settings` a `packages/server`-ben a `SqlSettingsRepository`-ra (I2) építve, contract DTO + kliensmetódus.

## Alak

- `GET /api/settings` → `SettingsResponse`: `{ values, followedLeagues, teamFilters, markets, bookmakers }`.
  - `values`: típusos skalár-beállítások (`evThreshold`, `minOdds`, `maxOdds`, `stakeUnit`, `backfillReserve`, `retention`); a
    `setting` táblában hiányzó kulcs → a core `DEFAULT_SETTINGS` értéke. DB-kulcsok snake_case (`ev_threshold`, …,
    `odds_retention` az architecture §4.1 szerint).
  - a többi a repository listái változatlanul (DTO-ra tükrözve).
- `PUT /api/settings` (JSON törzs, minden ág opcionális) → a frissített `SettingsResponse`:
  `{ values?, followedLeagues?: { upsert?, remove? }, teamFilters?: { upsert?, remove? }, markets?: [{id, stored}], bookmakers?: [{id, stored}] }`.

## Validálás (mind előbb, írás csak ha minden ág érvényes → nincs félig alkalmazott PUT)

- ismeretlen mező / ismeretlen `values` kulcs → 400; szám a core `NUMBER_LIMITS`-en belül; `stakeUnit` ∈ `STAKE_UNITS`;
  `retention` ∈ `RETENTION_OPTIONS`; `minOdds < maxOdds` az összefésült értékekre.
- `followedLeagues.upsert[].markets`: minden elem ismert `market.code` vagy piac-id szövegként; különben 400.
- `markets[]` / `bookmakers[]` id-nek léteznie kell; `teamFilters.mode` ∈ include|exclude; id-k pozitív egészek.
- nem JSON törzs → 400; `PUT` más végponton / más metódus → 405.

## Érintett fájlok

- `packages/contract/src/{dto,client,index}.ts` – DTO-k, `getSettings`, `updateSettings` (PUT, JSON törzs; `FetchLike` init
  `body?`).
- `packages/server/src/settings.ts` (új) – `parseSettingsUpdate` + `readSettings`/`applySettingsUpdate`.
- `packages/server/src/router.ts` – `deps.settings?` (hiányában 404), PUT engedélyezése csak itt.
- `packages/server/src/node.ts` – a kérés törzsének továbbítása (eddig csak GET volt).
- `packages/server/scripts/dev.ts` – bekötés `SqlSettingsRepository`-val.
- Tesztek: `contract.test.ts` (kliens ↔ handler, PGlite), `settings.test.ts` (validálás).

Web/mobil átkötése: külön szelet.
