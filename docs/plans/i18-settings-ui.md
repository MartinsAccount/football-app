# I18 – Beállítások UI a szerver-API-ra (ROADMAP 2.3)

A szelet >10 fájl lenne, ezért három részre bomlik:

- **I18a (ez):** a web `/settings` a `GET/PUT /api/settings`-ből (I3) tölt és oda ment.
  - core `settings/remote.ts`: `settingsFromRemote(res, fallback)` és `settingsUpdateFrom(saved, draft, res)` (+ teszt).
    Liga = `followed_league.enabled`; kivétel → `enabled: false` upsert (nem törlés). Piac: `h2h/ou25/btts` → bet-id 1/5/8,
    a `market.stored` jelző. Iroda: `bookmaker.stored`. DB-ben nem létező piac/iroda sor → a helyi (localStorage) érték marad,
    a PUT nem küldi. `stakeMode`, `backfillCap`, csapatszűrő érintetlen.
  - `SettingsStore`: opcionális `ISettingsRemote`; `syncStatus` (`off/loading/synced/offline`), `saving`, `saveError`.
    A localStorage gyorsítótár (első festés, offline tartalék); offline állapotban a mentés csak helyi.
  - `MainStore`: `readApi.getSettings/updateSettings`; Vite-proxy: `/api/settings` → :5100 (backlog-hiba).
  - UI: szinkron-pill a fejben, mentés-hiba és „Mentés…” a `SaveBar`-ban. Ligánkénti napi költség már megvan (S22).
- **I18b:** liga-katalógus olvasó-API (`GET /api/leagues`: `league` + aktuális `season` + `coverage`), a Ligák-lista és a
  `missingCoverage` ebből (a kézi `SETTINGS_LEAGUES` csak tartalék); csapatlétszám a `season_team`-ből a becsléshez.
- **I18c:** csapatszűrő (`team_filter` include/exclude) UI a követett ligák csapataiból.

Ellenőrzés: core + store unit-teszt, `npm run verify`, screenshot 1440/390 (sötét) a futó :5100 + :3000 párossal.
