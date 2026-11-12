# Architektúra: jelenlegi állapot, célállapot, migráció

> **Státusz:** Javaslat (nincs elfogadott döntés) · **Utolsó frissítés:** 2026-11-12 · **Tulajdonos:** Martin
>
> A dokumentumban minden „**Javaslat**” jelölésű döntés ADR-jelölt (lásd 12. fejezet). Amíg
> a tulajdonos nem fogadja el, **nem tekinthető döntésnek**. A platformok limitjei
> **2026-11-12-én lettek ellenőrizve**. Ezek gyakran változnak, ezért ADR írásakor újra kell
> ellenőrizni őket.
>
> Kapcsolódó dokumentumok: [`PRD.md`](PRD.md) · [`api/api-football.md`](api/api-football.md) ·
> [`analysis/strategy.md`](analysis/strategy.md) · [`ROADMAP.md`](ROADMAP.md)

---

## 1. Jelenlegi állapot (röviden)

| Réteg | Ma |
|---|---|
| Frontend | CRA 5 (`react-scripts@5`) + TypeScript + React 17 + **MobX v5** (legacy dekorátorok, `flow`) + `mobx-react@5` + react-router v5 + Tailwind. A `--legacy-peer-deps` telepítés kötelező. |
| API-hívás | **Közvetlenül a böngészőből**, a kulcsok 2026-11-12 óta a `frontend/.env`-ből jönnek (a böngésző-bundle-ben továbbra is láthatók). Két host keveredik (lásd [`api-football.md` §8](api/api-football.md#8-a-mostani-kód-hívásainak-auditja-frontendsrcservicesapiurlsts)). |
| Cache | `localStorage` (`LocalStorageUtil`, `ls_` prefix). Az arbitrázs-eredmény és a liga-id-k **1 év TTL**-lel vannak tárolva. |
| Backend | Express (`backend/server.js`). A `GET /api/odds` visszaadja az 5 országos JSON-t, a `POST /api/odds?country=` hozzáfűz a fájlhoz. Nincs DB. |
| Adat | `backend/stores/*-odds.json`: **2021-es szezon**, csak Unibet, ligánként kb. 100–110 meccs (2021-09 és 2022-02 között). `frontend/src/data/allMatch*_2020/2021.json`: a teljes 2020-as és 2021-es szezon meccsei, 5 ligában. |
| Hosting | Nincs (csak localhost). |
| Ütemezés | Nincs (gombnyomásra fut). |

## 2. Célarchitektúra (áttekintés)

```
                         ┌───────────────────────────── Hosting (Vercel, javaslat) ───────────────────────────┐
  Böngésző (tulajdonos)  │                                                                                     │
  ── védett ──────────▶  │  SPA (React + MobX)  ──fetch /api/*──▶  API-függvények (Node/TS)                    │
                         │                                         │  • olvasó végpontok (ajánlások, odds,     │
                         │                                         │    kiértékelés, beállítások, budget)      │
                         │                                         │  • /api/cron/tick  (ütemezett, titokkal)   │
                         │                                         ▼                                           │
                         │                              packages/core (tiszta TS: modell, kiértékelés, arbitrázs)│
                         └─────────────────────────────────────────┬───────────────────────────────────────────┘
                                                                   │ SQL (pooled / HTTP driver)
   Ütemező (Vercel Schedules, 15 percenként; ─────────────▶  Postgres (Neon, javaslat)
   tartalék: GitHub Actions / cron-job.org)                        ▲
                                                                   │
   API-Football (100 hívás/nap)  ◀── csak az API-függvényekből, a budget-őrön át
```

Alapelvek:

1. **A frontend soha nem hív külső API-t.** Minden a DB-ből jön, ezért a megnyitás 0 külső hívás.
2. **Minden külső hívás egy kliensen megy át:** budget-őr, szerializálás, naplózás.
3. **Az ingestion és a számítás ütemezett, kis lépésekből álló feladatsor.** Egy-egy futás
   rövid, idempotens és újrafuttatható.
4. **Tiszta mag** (`packages/core`): a modell, a kiértékelés és az arbitrázs I/O nélküli,
   unit-tesztelt függvények, a frontend és a backend közösen használja őket.

## 3. Hosting: Vercel vs. Netlify (döntés: D2)

Ellenőrizve 2026-11-12-én.

| Szempont | **Vercel Hobby** | **Netlify Free (kredit-alapú)** |
|---|---|---|
| Ütemezés | **Schedules (béta):** Hobby-n **legfeljebb 15 percenként**, 15 perces jitterrel. Havi 5 000 futás, IANA időzóna (alapértelmezett UTC), a `vercel.json` `schedules` blokkjában. A limitek a GA előtt változhatnak ([limits](https://vercel.com/docs/schedules/limits), [config](https://vercel.com/docs/schedules/configuration)). A régi **Cron Jobs** Hobby-n **naponta legfeljebb egyszer** fut, ±59 perc pontossággal, „best effort”, előfordulhat dupla futás; a védelme a `CRON_SECRET` ([cron usage](https://vercel.com/docs/schedules/cron-jobs/usage-and-pricing)). | Ütemezett függvények minden csomagban, cron szintaxissal, UTC-ben. A minimális gyakoriság nem dokumentált (**nem ellenőrzött**) ([scheduled functions](https://docs.netlify.com/build/functions/scheduled-functions/)). |
| Függvény futásideje | **300 s** (alapértelmezett és maximum, Fluid compute), 2 GB / 1 vCPU ([limitations](https://vercel.com/docs/functions/limitations)) | Szinkron **60 s**, **ütemezett 30 s**, background **15 perc** (a free csomagban is elérhető) ([configuration](https://docs.netlify.com/build/functions/configuration.md), [background](https://docs.netlify.com/build/functions/background-functions/)) |
| Havi keret | 1M hívás, 4 óra aktív CPU, 100 GB adatforgalom. Hobby-n nem vásárolható plusz keret ([limits](https://vercel.com/docs/limits)) | **300 kredit/hó, kemény limit.** Egy production deploy 15 kredit, a függvény 10 kredit/GB-óra. **A kredit elfogyásakor minden site leáll.** ([credits](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/)) |
| Hozzáférés-védelem | **Vercel Authentication** az összes deploymentre, a production-t is beleértve, **minden csomagban díjmentesen**. Jelszavas védelem csak Pro-ban van ([deployment protection](https://vercel.com/docs/deployment-protection)). | A jelszavas és basic-auth védelem csak Pro-ban van. A free csomagban **„Owner only” privát láthatóság** érhető el Netlify-logginnal ([visibility](https://docs.netlify.com/manage/security/secure-access-to-sites/project-visibility.md)). |
| DB-integráció | Marketplace: Neon, Supabase, Prisma Postgres, Aurora. A Vercel Postgres 2024 decemberében Neonra költözött ([postgres](https://vercel.com/docs/postgres)). | Netlify Database (GA 2026 áprilisától): 3 DB, 48 CU/időszak, a krediteket fogyasztja ([billing](https://docs.netlify.com/build/data-and-storage/netlify-database/billing-and-usage/)) |
| Felhasználási feltétel | A Hobby **csak nem kereskedelmi, személyes használatra** szól ([fair use](https://vercel.com/docs/limits/fair-use-guidelines)). A személyes tippelőeszköz, hirdetés és bevétel nélkül, ennek megfelel. | A free csomagban nincs ilyen kikötés a dokumentációban (a ToS-t nem olvastuk: **nem ellenőrzött**) |

**Döntés (tulajdonos, 2026-11-12): Vercel Hobby.** Indoklás:

- A 300 s-os futásidő **elég egy szerializált, ≤ 9 hívás/perces hívássorozathoz**, amely
  egy futásban kb. 20–30 hívást is elbír. A Netlify 30 s-os ütemezett limitje alatt csak
  background függvényre átadva lehetne ezt megoldani.
- A 15 percenkénti Schedules elég a „kezdés előtt ≤ 3 órával” snapshotokhoz.
- A Vercel Authentication **ingyenes, kódmentes egyfelhasználós védelem**.
- Nincs „kredit elfogyott, minden leáll” kockázat.

**Kockázat:** a Schedules béta. **Tartalék:** a régi napi Cron Job (napi futás), és egy
külső pinger, amely 15 percenként hívja a `/api/cron/tick`-et `Authorization: Bearer
<CRON_SECRET>` headerrel. A pinger lehet GitHub Actions `schedule` (min. 5 perc, késhet; a
nyilvános repóban 60 nap inaktivitás után kikapcsol, [docs](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows)),
vagy cron-job.org (ingyenes, min. 1 perc, 30 s timeout, [faq](https://cron-job.org/en/faq/)).
A 30 s-os timeout miatt a tick **azonnal 202-vel válaszoljon**, vagy egy futás legfeljebb
3–4 hívást végezzen.

## 4. Adatbázis (döntés: D3)

Ellenőrizve 2026-11-12-én.

| | **Neon Free** | **Supabase Free** | **Turso Free** | **Cloudflare D1** |
|---|---|---|---|---|
| Motor | Postgres | Postgres | libSQL (SQLite) | SQLite |
| Tárhely | **1 GB/projekt** (20 GB összesen) | **500 MB** | 5 GB | 500 MB/DB |
| Számítási keret | 100 CU-óra/projekt/hó; 5 perc tétlenség után alszik, ébredés „néhány száz ms” | megosztott CPU, 500 MB RAM | 500M olvasott és 10M írt sor/hó | 5M olvasott / 100k írt sor/nap |
| **Inaktivitás** | **Nincs szüneteltetés** | **1 hét inaktivitás után szünetel** | nem dokumentált | — |
| Extra | branch-ek (10), HTTP driver (`@neondatabase/serverless`), PgBouncer | beépített Auth, pg_cron (free-ben **nem ellenőrzött**) | — | csak Cloudflare Workers mellett |
| Forrás | [plans](https://neon.com/docs/introduction/plans), [scale-to-zero](https://neon.com/docs/introduction/scale-to-zero), [driver](https://neon.com/docs/serverless/serverless-driver) | [pricing](https://supabase.com/pricing) | [pricing](https://turso.tech/pricing) | [limits](https://developers.cloudflare.com/d1/platform/limits/) |

**Választás (tulajdonos, 2026-11-12): Supabase Postgres (Free), Vercel
Marketplace-integrációval.** Indoklás: a tulajdonos más projektekben is ezt használja
(ismert eszköz, admin felület, opcionális Supabase Auth), és Postgres (`jsonb`,
ablakfüggvények az elemzéshez). Következmények:

- **500 MB tárhely** → csak az elemzett piacokat tároljuk normalizált sorként (lásd a
  becslést lent: kb. 2 szezon odds fér el; ha szűk, régi snapshotok aggregálása / archiválása).
- **1 hét inaktivitás után szünetel** → amíg nincs ütemezett ingestion, a dashboardon kell
  újraindítani; utána a 15 percenkénti írás ébren tartja.
- **Free-ben max. 2 aktív projekt / szervezet** — ellenőrizni a tulajdonos meglévő projektjei mellett.
- Az elemzéshez szükséges SQL Postgres-szabvány marad (Supabase-specifikus funkcióra nem
  építünk), így Neonra (1 GB) váltás egy `DATABASE_URL` csere + migrációk újrafuttatása.

**ORM / migráció (ADR-jelölt):** **Drizzle** (könnyű, SQL-közeli, Neon HTTP driverrel
közvetlenül működik; a hivatalos dokumentációját nem néztük, ezért **nem ellenőrzött**),
vagy **Prisma 7** (driver adapter kötelező, [upgrade guide](https://www.prisma.io/docs/orm/more/upgrade-guides/upgrading-versions/upgrading-to-prisma-7)).
**Javaslat: Drizzle + SQL-migrációs fájlok a repóban.**

**Tárhelybecslés (odds a domináns tétel):**
`sorok = meccsek × snapshot/meccs × irodák × kimenetelek (az elemzett piacokon)`.
Megszorítás nélkül: 5 top liga × kb. 1 750 meccs/szezon × 3 snapshot × kb. 250 sor (15–20
iroda) ≈ 1,3M sor/szezon, soronként kb. 60–80 bájt plusz index → **≈ 150–250 MB/szezon**,
vagyis 500 MB-ba kb. 2 szezon fér. A meccsek, tabellák, statisztikák, predikciók
nagyságrenddel kisebbek; a 2022–2024 historikus szezonokhoz API-odds nincs, a
football-data.co.uk CSV kb. 1 MB/liga/szezon. A tárhelyet tehát az **élesítés után gyűlő**
odds viszi — ezt a 4.1 tárolási szabályai szorítják le.

### 4.1 Tárolási szabályok (konfigurálható, PRD 5.3)

| Beállítás | Hol | Hatás | Alapértelmezés (javaslat) |
|---|---|---|---|
| Követett ligák | `followed_league.enabled` | Csak ezekre fut ingestion és tárolás | a meglévő 5 top liga |
| Tárolt piacok | `market.stored` (globális) + `followed_league.markets` (ligánkénti felülírás, `null` = globális) | Az `odds_quote` csak ezeket a piacokat kapja | 1X2, Over/Under 2.5, BTTS |
| Tárolt irodák | `bookmaker.stored` | Az `odds_quote` csak ezeket az irodákat kapja | kb. 5 nagy iroda |
| Aggregátum | `odds_best` mindig mentve | A legjobb és az átlag odds **a teljes lekért válaszból** számolódik, mielőtt az iroda-szűrés eldobná a többit → az EV és az arbitrázs nem romlik | be |
| Snapshot-megőrzés | `setting.odds_retention` | Lejátszott meccsnél csak `opening` + `closing` snapshot marad; a köztesek törlődnek (napi karbantartó job) | be |
| Nyers válasz | `api_raw_response` | Hibakereséshez, legfeljebb 14 napig | ki |

- A piac-/iroda-szűrés a **tárolásra** vonatkozik, nem a lekérésre: egy `/odds` hívás úgyis
  az összes piacot visszaadja, a hívásszámot ez nem változtatja.
- Ha egy piacot később bekapcsolunk, arra csak onnantól lesz adat (az API-ból a múltbeli
  odds nem pótolható) → a UI ezt jelezze kapcsoláskor.
- Ezekkel (5 iroda, 3 piac, nyitó + záró) a becslés kb. **10–20 MB/szezon/5 liga** →
  500 MB-ba 10–15 liga több szezonja is belefér. A Beállítások UI ezt a becslést mutatja.

## 5. Titkok és konfiguráció

| Titok | Hol | Megjegyzés |
|---|---|---|
| `API_FOOTBALL_KEY` | Hosting env var (Secret típus), és lokálisan a `backend/.env` (gitignore) | A frontend bundle-be **soha** nem kerülhet. A repóban lévő régi kulcsokat érvényteleníteni kell (ROADMAP 0.2). |
| `DATABASE_URL` | Hosting env (a Marketplace injektálja) | Dev: Neon branch vagy lokális Postgres (Docker). |
| `CRON_SECRET` | Hosting env | `Authorization: Bearer` a tick-végponton. |
| `APP_PASSWORD_HASH`, `SESSION_SECRET` | Hosting env | Az alkalmazásszintű belépéshez (6. fejezet). |
| `API_DAILY_LIMIT` (100), `API_RESERVE` (5), `API_MIN_INTERVAL_MS` (7000) | env vagy `setting` tábla | A budget-őr paraméterei. |
| `USE_FIXTURES=true` | dev és teszt | A mock kliens rögzített válaszokból dolgozik, élő hívás nincs. |

## 6. Hozzáférés-védelem (döntés: D4)

**Javaslat: két réteg.**

1. **A platform rétege:** a Vercel Authentication a production deploymentre (díjmentes).
   Csak a tulajdonos Vercel-fiókja fér hozzá. Ehhez nem kell kódot írni.
2. **Az alkalmazás rétege (védelem a mélyben):** egyfelhasználós login. A jelszó argon2/bcrypt
   hash-e env-ben van; a session httpOnly + Secure + SameSite=Strict cookie; minden `/api/*`
   (kivéve `/api/cron/*`, amely `CRON_SECRET`-tel védett) session-t kér. Rate limit a
   login-végponton.

Indoklás: ha a platformot később lecseréljük, vagy a platformvédelem kikapcsol (pl. egy
preview-beállítás miatt), az adat és a kvóta akkor se legyen nyilvános. Teljes
auth-szolgáltatás (Auth.js, Supabase Auth) **egy felhasználóhoz túlzás**.

## 7. Ingestion: ütemező, feladatsor, kvóta-elszámolás

### 7.1 Felépítés

```
tick (15 percenként) ──▶ 1. planner: hiányzó feladatok felvétele (idempotens, dedupe_key)
                         2. worker:  esedékes feladatok prioritás szerint,
                                     amíg (budget ok) ÉS (idő < 240 s) ÉS (hívás/futás < 25)
                         3. derive:  új adat → feature-ök → predikció → kiértékelés (0 API-hívás)
```

- **`ingest_task` tábla:** `kind`, `params`, `dedupe_key` (UNIQUE), `priority`, `not_before`,
  `deadline`, `est_calls`, `status`, `attempts`, `last_error`.
- **Planner-szabályok** (a beállított ligákra; a hívásszámok: [`api-football.md` §6](api/api-football.md#6-hívás-budget)):

| Feladat | Mikor (`not_before`, `deadline`) | Prioritás |
|---|---|---|
| `odds_late` (ligánként, meccsnaponként) | a nap első kezdése előtt 3 óra, határidő: a kezdés | **1 (legmagasabb)** |
| `injuries` (`ids` köteg) | T−24 óra | 2 |
| `odds_early` (liga) | T−48…T−24 óra | 2 |
| `results` (`fixtures?ids`) | kezdés + 3 óra, második kör + 26 óra, ha még nincs `FT` | 3 |
| `standings` | a forduló előtti nap | 3 |
| `fixtures_window` (liga, következő 7 nap) | naponta 1×, 04:00 UTC | 3 |
| `reference` (`leagues`, `bookmakers`, `bets`, `teams`) | hetente vagy havonta | 4 |
| `predictions_api` (opcionális, csak a jelöltekre) | T−24 óra | 4 |
| `backfill_*` | bármikor, csak a tartalékkeretből | 5 (legalacsonyabb) |

### 7.2 Kvóta-elszámolás

- **`api_budget_day`** (UTC-nap): az `UPDATE … SET used = used + 1 WHERE day = $1 AND used <
  limit - reserve RETURNING used` **a hívás előtt** foglal (atomikus). Ha nincs sor, nincs
  hívás.
- **A backfill külön plafont kap** (pl. `used < 70` esetén indulhat). Az esti `odds_late`
  feladatnak mindig marad keret.
- **Minden hívás után** naplóz az `api_call_log`-ba, és eltárolja a headerből a
  `x-ratelimit-requests-remaining` értéket. Ha ez eltér a saját számlálótól, a
  szigorúbb érték érvényes.
- **A `/status` hívás ingyenes**: a futás elején ezzel szinkronizálunk.
- **A hívások szerializáltak**, köztük legalább 7 s szünet, egy futáson belül. Két tick nem
  futhat egyszerre: ezt egy Postgres advisory lock (`pg_try_advisory_lock`) biztosítja.

### 7.3 Idempotencia és hibatűrés

- Az entitások **upserttel** íródnak (az API-id a kulcs). A snapshotok kulcsa
  `(fixture_id, captured_at, source)`, és **csak beszúrás** történik.
- Ha egy feladat elbukik: `attempts++`, exponenciális visszalépés. **Kivétel:** az
  `errors.plan` vagy a kvótahiba **nem ismétlődik** aznap.
- Ha egy feladat lekési a `deadline`-t (pl. nem készült el a késői snapshot), `skipped`
  státuszt kap. Ezt a dashboard mutatja (PRD 9. fejezet: kihagyott snapshot < 5%).

## 8. Elemzés és ajánlás: hol fut

| Lépés | Hol | Mikor |
|---|---|---|
| Feature-számítás (forma, tabella, tét, H2H, szezonszakasz, sérültek) | API-függvény (`derive` lépés), a `packages/core` tiszta függvényeivel, a DB-adatokból | új odds- vagy sérült-snapshot után |
| Predikció és ajánlás | ugyanott | az `odds_early` és `odds_late` snapshot után |
| Kiértékelés | ugyanott | `results` után |
| **Modell-illesztés** (Elo-, Poisson-paraméterek) és **backtest** | **Lokálisan, Node CLI-szkripttel** (`npm run backtest -- --model=… --seasons=2022-2024`), a DB-re vagy egy exportra | kézzel, iterációnként; a paraméterek a `model_version.params`-ba kerülnek |

**Javaslat:** **TypeScript mindenhol** (egy nyelv, közös `core`, agent-barát). Feltáró
elemzéshez opcionálisan Python vagy notebook DB-exportra, de **az éles modell TS-ben
fut**. (ADR-jelölt, ha a tulajdonos a Pythont preferálja.)

### 8.1 Javasolt repó-szerkezet (célállapot)

```
frontend/            # SPA (a mai mappa; Vite-migráció után is itt marad)
api/                 # Vercel-függvények: api/recommendations.ts, api/cron/tick.ts, ...
packages/core/       # tiszta TS: arbitrage/, model/, evaluation/, features/ (+ Jest/Vitest)
packages/db/         # séma (Drizzle), migrációk, repository-függvények
packages/api-client/ # API-Football kliens: budget-őr, naplózás, mock mód, fixture-ök
scripts/             # backfill, backtest, import (legacy JSON, football-data.co.uk CSV)
backend/             # a régi Express: a migráció végéig marad, utána megszűnik
```

npm workspaces a gyökérben. Ez az első gyökérszintű tooling, és a ROADMAP 1. fázisában jön létre.

## 9. Frontend: marad a CRA + MobX, vagy migrálunk? (döntés: D5)

Tények: a React csapata **2025 februárjában megszüntette a Create React App támogatását**,
új projektre nem ajánlja ([react.dev blog](https://react.dev/blog/2025/02/14/sunsetting-create-react-app)).
A mostani stack (MobX v5 + `mobx-react@5` + React 17) csak `--legacy-peer-deps`-szel települ
(ADR 0001).

| Opció | Előny | Hátrány |
|---|---|---|
| **A. Marad (CRA 5 + MobX v5)** | 0 migrációs munka | elavult toolchain, lassú build, peer-konfliktusok; az új oldalakat is a régi mintában kell írni |
| **B. Vite + React 18 + MobX 6, a stílus marad** (`makeObservable` + dekorátorok; az osztálykomponensek és az `inject` maradhatnak) | Fokozatos, a mostani boltok és komponensek nagyrészt változatlanok; gyors dev és teszt (Vitest); a Vercel natívan támogatja | egyszeri migrációs szelet, a MobX 6 dekorátor-szemantikája kis átírást kér |
| **C. Next.js (fullstack)** | egy projektben a frontend és az API, a Vercel „natív” stackje | nagy átírás (router, adatbetöltés, SSR); az osztálykomponens + MobX minta idegen tőle; egy egyfelhasználós SPA-nak nem kell SSR |

**Javaslat: B, két lépésben.** (1) CRA → Vite, MobX v5 marad, a viselkedés változatlan. (2)
MobX 5 → 6 és React 17 → 18. Az új oldalak (ajánlások, kiértékelés, beállítások) készülhetnek
függvénykomponensként is, `observer`-rel; a meglévő oldalakhoz nem kell nyúlni. **Ez a
döntés nem blokkolja a backend-munkát**, ezért a ROADMAP-ben a backend után következik.

## 10. Adatmodell (Postgres, javaslat)

Konvenciók: az API-id-k természetes kulcsok (`bigint`). Minden időpont `timestamptz` UTC-ben.
A **snapshot- és predikciótáblák append-only** jellegűek. A táblanevek angolok (SQL-konvenció);
a kódban a magyar domain-nevek (pl. `Vegeredmeny`) a `market.code` mezőben élnek tovább.

### 10.1 Törzsadat

| Tábla | Kulcs | Fő oszlopok | Megjegyzés |
|---|---|---|---|
| `league` | `id` | `name`, `country`, `type` (league/cup), `logo_url` | `/leagues` |
| `season` | (`league_id`, `year`) | `start_date`, `end_date`, `is_current`, `coverage jsonb`, `coverage_checked_at` | a `coverage` flagek innen jönnek |
| `team` | `id` | `name`, `code`, `country`, `logo_url` | `/teams` |
| `team_alias` | (`source`, `name`) | `team_id` | a football-data.co.uk CSV-k és más források csapatneveinek leképezése |
| `season_team` | (`league_id`, `year`, `team_id`) | — | ki játszik az adott ligában |
| `bookmaker` | `id` | `name`, `stored bool` (tárolási beállítás, §4.1) | `/odds/bookmakers` |
| `market` | `id` (API bet id) | `name` (API), `code` (pl. `Vegeredmeny`), `analyzed bool`, `stored bool` (tárolási beállítás, §4.1) | `/odds/bets` + `BetTypes.ts` |

### 10.2 Meccsek és események

| Tábla | Kulcs | Fő oszlopok | Index |
|---|---|---|---|
| `fixture` | `id` | `league_id`, `season`, `round`, `kickoff_at`, `status`, `home_team_id`, `away_team_id`, `goals_home/away`, `ht_home/away`, `ft_home/away` (rendes játékidő), `et_*`, `pen_*`, `venue_id`, `referee`, `updated_at` | (`league_id`,`season`,`kickoff_at`), (`status`,`kickoff_at`), (`home_team_id`), (`away_team_id`) |
| `fixture_team_stats` | (`fixture_id`, `team_id`) | `shots_total`, `shots_on`, `corners`, `possession`, `fouls`, `yellow`, `red`, `saves`, `passes_pct`, `raw jsonb` | — |
| `fixture_event` | (`fixture_id`, `seq`) | `minute`, `extra`, `team_id`, `player_id`, `type`, `detail` | v1: csak a gólok és a piros lapok |
| `standing_snapshot` | (`league_id`, `season`, `captured_at`, `team_id`) | `rank`, `points`, `played`, `win`, `draw`, `lose`, `gf`, `ga`, `form`, `description`, `group_name` | az API csak az aktuális tabellát adja |
| `standing_derived` *(nézet vagy materializált)* | (`league_id`, `season`, `as_of`, `team_id`) | ugyanaz | **a meccsekből újraszámolt, pont-idejű tabella** (backtest, szezonszakasz) |
| `injury_report` | (`fixture_id`, `player_id`, `captured_at`) | `team_id`, `player_name`, `type` (Missing Fixture / Questionable), `reason` | `/injuries?ids` |
| `player` *(később)* | `id` | `name`, `position`, `rating_season` | a kulcsjátékos-súlyozáshoz |

### 10.3 Odds

| Tábla | Kulcs | Fő oszlopok | Megjegyzés |
|---|---|---|---|
| `odds_snapshot` | `id` (bigserial); UNIQUE(`fixture_id`, `captured_at`, `source`) | `fixture_id`, `captured_at` (amikor mi lekértük), `provider_updated_at` (az API `update` mezője), `source` (`api-football` / `football-data-csv` / `legacy-json` / `manual`), `kind` (`early` / `late` / `adhoc` / `opening_csv` / `closing_csv`) | append-only |
| `odds_quote` | (`snapshot_id`, `bookmaker_id`, `market_id`, `selection`) | `line numeric null` (pl. 2.5), `odd numeric(7,3)` | **csak a `stored` piacok × `stored` irodák** (§4.1) |
| `odds_best` *(tábla)* | (`snapshot_id`, `market_id`, `selection`, `line`) | `max_odd`, `bookmaker_id`, `avg_odd`, `n_books` | a **teljes** lekért válaszból számolva, szűrés előtt; az ajánlásnak és az arbitrázsnak |

### 10.4 Modell, predikció, kiértékelés

| Tábla | Kulcs | Fő oszlopok | Megjegyzés |
|---|---|---|---|
| `model_version` | `id` (pl. `elo-poisson@0.3.1`) | `created_at`, `description`, `params jsonb`, `git_sha`, `status` (`dev` / `shadow` / `live` / `retired`) | |
| `prediction_run` | `id` | `model_version`, `started_at`, `trigger` (`schedule` / `manual` / `backtest`), `as_of` (backtestnél a szimulált idő) | |
| `prediction` | `id`; UNIQUE(`run_id`, `fixture_id`, `market_id`, `selection`, `line`) | `fixture_id`, `market_id`, `selection`, `line`, `p_model`, `p_market_fair`, `odds_snapshot_id`, `best_odd`, `best_bookmaker_id`, `min_acceptable_odd`, `ev`, `is_recommendation`, `stake_units`, `confidence`, **`features jsonb`** (pillanatkép), **`explanation jsonb`** (a tényezők hozzájárulása), `warnings jsonb`, `created_at` | **append-only**, utólag nem módosítható |
| `evaluation` | `prediction_id` | `settled_at`, `outcome` (`win` / `loss` / `void` / `half_win` / `half_loss`), `profit_units`, `brier`, `log_loss`, `closing_snapshot_id`, `closing_odd`, `clv` | külön tábla, így a predikció változatlan marad |
| `placed_bet` | `id` | `prediction_id null`, `fixture_id`, `market_id`, `selection`, `bookmaker_label` (pl. Tippmix), `odd_taken`, `stake`, `placed_at`, `note` | a tulajdonos ténylegesen megtett tippjei |

### 10.5 Beállítások és üzem

| Tábla | Kulcs | Fő oszlopok |
|---|---|---|
| `followed_league` | `league_id` | `enabled`, `priority`, `markets text[] null` (tárolt piacok ligánkénti felülírása; `null` = globális `market.stored`), `added_at` |
| `team_filter` | `team_id` | `mode` (`include` / `exclude`) |
| `setting` | `key` | `value jsonb` (EV-küszöb, min/max odds, tét-mód, egység, backfill-plafon, aktív `model_version`) |
| `ingest_task` | `id`; UNIQUE(`dedupe_key`) | lásd 7.1 |
| `api_budget_day` | `day` (UTC dátum) | `used`, `limit`, `reserve`, `synced_remaining` |
| `api_call_log` | `id` | `called_at`, `endpoint`, `params jsonb`, `http_status`, `errors jsonb`, `results`, `paging_total`, `quota_remaining_day`, `rate_remaining_min`, `duration_ms`, `task_id`, `mock bool` |
| `api_raw_response` *(opcionális)* | `call_id` | `body jsonb`, 14 nap megőrzés (újrafeldolgozáshoz, hibakereséshez) |

## 11. Migráció a mai állapotból

| Lépés | Mit | Megjegyzés |
|---|---|---|
| 1 | **Mock mód és rögzített válaszok** (`packages/api-client/fixtures/`) | A meglévő `frontend/src/data/*.json` és `backend/stores/*.json` **már valódi API-válaszok**. Belőlük készülnek az első fixture-ök, 0 hívással. |
| 2 | **DB-séma + import-szkript a régi JSON-okhoz** | `backend/stores/*-odds.json`: 2021-es szezon, Unibet, `odds_snapshot.source = 'legacy-json'`, a `captured_at` = a payload `update` mezője. `frontend/src/data/allMatch*_2020/2021.json`: `fixture` + `team` + `league`. Az idempotens import 0 API-hívás. |
| 3 | **Backend proxy + budget-őr** | Az Express routerből vagy Vercel-függvényből indul; a régi `GET/POST /api/odds` párhuzamosan él, amíg a `/odds` oldal át nem áll. |
| 4 | **A frontend átállítása** az új olvasó végpontokra, oldalanként | A `FetchService*` és az `ApiURLs.FOOTBALL` megszűnik a frontendben. |
| 5 | **A localStorage-cache kivezetése** | Az `ls_Arbitrages` és `ls_AllLeagueIds` helyére a DB lép. A `LocalStorageUtil` csak a UI-preferenciákra marad (pl. szűrők). A régi kulcsokat egy egyszeri kód törli. |
| 6 | **A régi Express és a JSON-fájlok archiválása** | A JSON-ok `data/legacy/` alá kerülnek, vagy törlődnek az import ellenőrzése után; ez a tulajdonos döntése. |
| 7 | **Backfill** 2022–2024 (API, tartalékkeretből) + football-data.co.uk CSV import (odds, 0 hívás) | lásd [`api-football.md` §6.4, §7.3](api/api-football.md) |

## 12. ADR-jelöltek (döntésre várnak)

| # | Téma | Javaslat | Függ tőle |
|---|---|---|---|
| ADR-0002 | **Adatforrás / API-csomag** (a free csomag szezon-hozzáférése) | Mérés, utána Pro csomag vagy több forrás | minden ingestion |
| ADR-0003 | **Hosting** | Vercel Hobby | ütemező, auth |
| ADR-0004 | **Adatbázis + ORM** | Neon Postgres + Drizzle | adatmodell |
| ADR-0005 | **Hozzáférés-védelem** | Vercel Authentication + egyfelhasználós app-session | deploy |
| ADR-0006 | **Ütemezés és feladatsor** | 15 perces tick + `ingest_task` + advisory lock; tartalék: külső pinger | ingestion |
| ADR-0007 | **Frontend toolchain** | Vite, MobX marad (később v6) | UI-munka |
| ADR-0008 | **Repó-szerkezet** (npm workspaces, `packages/core`) | igen | minden backend-szelet |
| ADR-0009 | **Modellezés nyelve** | TS az élesben; Python opcionális a feltáráshoz | strategy |
| ADR-0010 | **Odds-tárolási szint** | csak az elemzett piacok normalizálva, nyers payload 14 napig | tárhely |

Az ADR-ek helye: `docs/adr/`.
