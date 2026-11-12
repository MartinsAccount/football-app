# Terv: API hívások minimalizálása és optimalizálása

> **Státusz:** ⛔ **Elavult (superseded), 2026-11-12** · Eredeti dátum: 2026-06-12 · **Tulajdonos:** Martin
>
> **Ezt a fájlt ne használd tervezéshez.** Akkor készült, amikor a projekt egyetlen
> célja az arbitrázs volt. Azóta a fő funkció a tippajánló motor
> ([`../PRD.md`](../PRD.md)), az app pedig backend-proxyval, DB-vel és ütemezett
> ingestionnel működik majd ([`../architecture.md`](../architecture.md)).
>
> **Hová került a tartalma:**
>
> | Itt | Most itt van |
> |---|---|
> | 1. A megkötés (napi 100 hívás) | [`../api/api-football.md` §1](../api/api-football.md#1-legfontosabb-tények-tldr) (frissítve: Free-csomag szezon-korlát, 7 napos odds-megőrzés, lapozás) |
> | 2. Jelenlegi hívási pontok | [`../api/api-football.md` §8](../api/api-football.md#8-a-mostani-kód-hívásainak-auditja-frontendsrcservicesapiurlsts): kódaudit, új hibákkal (az `/odds` csak az 1. oldalt kéri le, host-keveredés) |
> | 3. Mérés | ROADMAP 3.7 (ingestion-mérés) és 8.2 (a teljes piaci pásztázás előzetes becslése) |
> | 4. Optimalizálási ötletek | [`../api/api-football.md` §5–6](../api/api-football.md#6-hívás-budget) (kliensszabályok, budget, stratégiák) és [`../architecture.md` §7](../architecture.md#7-ingestion-ütemező-feladatsor-kvóta-elszámolás) (budget-őr, feladatsor) |
> | 5. Nyitott kérdések | A kvóta-nullázás (00:00 UTC, nem ellenőrzött) → api-football.md §1; a több napra elosztott futás → backfill (ROADMAP 4.1); a backend mint cache → elfogadott irány (ROADMAP 1. fázis) |
>
> Az alábbi szöveg **változatlan történeti rögzítés**.

---

## 1. A megkötés (miért csináljuk)

- Az API a **free tier**-en fut: **napi 100 hívás** a teljes keret
  (nem percenkénti — _napi_ limit).
- A jelenlegi kód a régi „10 kérés / perc" logikára van hangolva
  (~61 mp szünet 10 hívásonként, lásd `timeoutAllLeaguesId`), ami a
  **napi** limitet nem veszi figyelembe.
- Cél: egy teljes arbitrázs-futás férjen bele a napi keretbe, és a
  felesleges/ismételt hívások szűnjenek meg.

---

## 2. Jelenlegi hívási pontok (mérés előtti becslés)

Forrás: `frontend/src/pages/ArbitragePage/stores/ArbitrageStore.ts`,
`frontend/src/services/ApiURLs.ts`.

| Fázis | Hol | Végpont | Hívások száma |
|---|---|---|---|
| 1. Liga-id-k gyűjtése | `searchAllLeagueIds` → `AVAILABLE_FIXTURES_FOR_ODDS(page)` | `/odds/mapping?page=N` | **1 / oldal**, összesen `totalPage` oldal |
| 2. Odds-elemzés | `helperHighestOdds` → `getHighestOdds(leagueId)` → `GET_LEAGUE_ODDS` | `/odds?league=&season=` | **1 / liga-id** |
| (egyéb) | `getFixtureById` stb. | `GET_FIXTURE` | eseti, fixture megnyitáskor |

**Egy teljes futás durva képlete:** `totalPage + (ligák száma)` hívás.

> ⚠️ Ez a napi 100-as keretet **egyetlen futással** kimerítheti.
> A pontos számokat ki kell mérni (lásd 3. pont), mert a `totalPage`
> és a ligák száma a `/odds/mapping` válaszától függ.

### Meglévő, már beépített védelmek
- **localStorage cache** (`LocalStorageUtil`, `ls_` prefix, TTL-alapú):
  - `AllLeagueIds` → `OneYear` TTL
  - `Arbitrages` → `OneYear` TTL
  - `searchAllLeagueIds(_, dataFromCache=true)` rövidre zárja a teljes
    pipeline-t a cache-ből → **0 hívás**, ha van érvényes cache.
- **Throttle**: `helperAllLeaguesId` 61 mp szünetet tart 10 hívásonként
  (perc-limithez, nem nap-limithez).
- **`MainStore.fetchNumber`**: számolja a hívásokat (mérésre használható).

---

## 3. Mérés (mielőtt bármit optimalizálunk)

Vakon ne optimalizáljunk. Először ki kell deríteni:

- [ ] Egy teljes „from scratch" futás (cache nélkül) **hány hívást** csinál?
      → `MainStore.fetchNumber` a futás végén.
- [ ] Ebből mennyi az 1. fázis (`totalPage`) és mennyi a 2. fázis (ligák száma)?
- [ ] Mennyi a tényleg releváns (jövőbeli, még nem lejátszott) liga aránya?
      A `getHighestOdds` futás közben sok már lejátszott meccset eldob
      (`continue`), de a **hívás már megtörtént** rájuk.

---

## 4. Optimalizálási ötletek (még nem döntés)

Prioritás szerint, a legnagyobb megtérülés felül:

1. **Napi keret-tudatos throttle.** A jelenlegi perc-alapú 61 mp szünet
   helyett/mellett egy napi hívásszámláló perzisztálva (localStorage),
   ami megáll / figyelmeztet a keret közelében. → valószínűleg ADR-t érdemel.
2. **Erősebb / perzisztens cache.** A liga-id lista ritkán változik —
   jelenleg `OneYear`, de érdemes átgondolni a `Arbitrages` TTL-jét
   (most `OneYear`, ami túl hosszú élő oddsokhoz). Reális napi/órás TTL.
3. **2. fázis szűkítése a hívás ELŐTT.** Ne kérjünk le minden ligát,
   csak amelyikre tényleg van jövőbeli, oddsozható meccs — a szűrést
   az 1. fázis (`/odds/mapping`) adata alapján a `GET_LEAGUE_ODDS` hívás
   _előtt_ végezzük el, hogy meg se történjen a felesleges hívás.
4. **Backend mint cache-réteg.** A `backend/` már perzisztál odds JSON-okat
   lemezre (`stores/*.json`). Át lehet gondolni, hogy a frontend a backendet
   kérdezze (0 külső hívás), és csak a backend frissítsen kontrolláltan,
   napi 1×, a külső API-ból. Ez nagyobb átalakítás → külön ADR.
5. **Holt/teszt hívások kivezetése.** `testFetch`, a `> 20 && < 22`
   console-log ágak stb. — ezek nem hívnak feleslegesen, de zajt adnak;
   a mérést tisztábbá teszi, ha kikerülnek.

---

## 5. Nyitott kérdések

- A napi 100 hívás **mikor nullázódik** (UTC éjfél? rolling 24h)? Ez
  befolyásolja a keret-tudatos throttle logikáját.
- Elfogadható-e, hogy egy teljes friss futás **több napra** elosztva fusson,
  ha nem fér bele 100 hívásba?
- A backend-mint-cache irány (4.4) belefér-e a refactor scope-jába, vagy
  külön feladat?

---

## 6. Következő lépés

→ **3. pont (mérés)**: kimérni egy teljes futás tényleges hívásszámát,
mielőtt bármelyik ötletet implementáljuk. Addig ez a terv becslésen áll.
