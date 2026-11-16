# I24 – 8.3 Az arbitrázsoldal régi útjának kivezetése

**Cél:** a frontendből megszűnik minden közvetlen API-Football-hívás és a régi `localStorage`-gyorsítótár
(`ls_Arbitrages`, `ls_AllLeagueIds`). Az `/arbitrage` már az olvasó API-ból tölt (SB5: `readApi.getArbitrage`, I22: DB-ből).

**Helyzet:** a `LegacyArbitragePage` S24 óta nincs routolva, de az `ArbitrageStore` a `MainStore`-ban példányosul, és vele a
RapidAPI-s `FetchService` is. Az `OddsPage` már a `readApi`-ból olvas.

**Törlés (csak kód, adat nem):**

- `pages/ArbitragePage/`: `LegacyArbitragePage.tsx`, `components/` (5), `models/` (4), `services/ArbitrageService.ts`,
  `stores/ArbitrageStore.ts`.
- `services/`: `FetchService.ts`, `FetchService3.ts`, `ApiURLs.ts`, `fixtures/` (resolver + teszt).
- `shared/utils/LocalStorageUtil.ts`; a csak ezek által használt `core/constants` / `core/models` fájlok.
- `MainStore`: `ArbitrageStore` és `FetchService` mező ki.
- `vite-env.d.ts`: a két API-kulcs típusa ki (a `.env` / `.env.example` nem változik).

**Marad:** `frontend/src/data/*.json` és `backend/stores/*.json` (adat; sorsa 8.4, tulajdonosi döntés); `dataMode.ts` + a
`BudgetChip` `fixture`/`localCalls` propjai (a fejléc-pill; a `fetchNumber` mostantól 0 → TODO(polish)); a core
`analyzeBookmakers` (a régi ≡ új egyezés tesztje).

**Ellenőrzés:** `npm run verify`; `grep` a `frontend/src`-ben: nincs `api-football`/`api-sports`/`rapidapi` host és `ls_` kulcs;
a build-bundle-ben sincs; screenshot `/arbitrage` 1440 + 390 (scratchpad-seed, :5100 + :3000).
