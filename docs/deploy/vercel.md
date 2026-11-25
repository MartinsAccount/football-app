# Vercel-deploy és ütemező – runbook (ROADMAP 1.6, 1.7)

> Állapot: 2026-11-25. **Első deploy kész** (lásd „Első deploy – tapasztalatok” lent). Korábbi megjegyzés: **még egyszer sem futott le** – az első deploy után javítsd, ahol eltér a valóságtól. A Vercel-tények
> forrása a vercel.com/docs (2026-11-24-i olvasás); ahol ⚠️ áll, ott a doksi ellentmondásos vagy nem ellenőrzött.

Három rész: **A** – kód-előfeltételek (agent-szeletek, ezek nélkül a deploy nem működik), **B** – tulajdonosi lépések (fiók,
projekt, titkok), **C** – ellenőrzés és visszaállás.

## A. Kód-előfeltételek

| Szelet | Mit | Megjegyzés |
|---|---|---|
| ✅ **I30 – 1.6a Vercel-belépési pont** (2026-11-25) | **Build Output API v3:** a `vercel.json` csak `buildCommand` (`npm run build && node scripts/vercel-build.mjs`). A script a `frontend/build`-et a `.vercel/output/static`-ba másolja, a `packages/server/src/vercelEntry.ts`-t esbuild-del egy fájlba csomagolja (`functions/api.func/index.mjs`, `nodejs22.x`, `maxDuration: 300`, a `data/*/*-v0.json` pillanatképek mellé), és megírja a `config.json`-t: `/api*` → függvény, fájlrendszer, SPA-fallback, `schedules.cron-tick` (`*/15 * * * *`, path `/api/cron/tick`). A handler (`createVercelHandler`): fail-closed (`production` mindig igaz), kérésenként lusta DB-kapcsolat (`openPg(DATABASE_URL)`, migráció nincs), tick **worker nélkül** (no-op). | Miért nem zero-config `api/index.ts`: a workspace-csomagok TS-forrásként, kiterjesztés nélküli ESM-importokkal mennek, ezt a Node-builder nem garantáltan futtatja, a `vercel build` pedig Windows-on nem fut (symlink-jog). Helyben: `npm run build && node scripts/vercel-build.mjs`, majd `node scripts/vercel-build.mjs --serve` (port 5300). Élő ingestion = 3.7 💸, külön. |
| ✅ **I31 – 1.6b Web-login** (2026-11-25) | Egy admin-jelszó (felhasználónév nincs): `POST /api/login` (PBKDF2-hash az `APP_PASSWORD_HASH`-ban) → állapotmentes, HMAC-aláírt süti (`SESSION_SECRET`, 30 nap, `HttpOnly; Secure; SameSite=Strict; Path=/api`), `POST /api/logout`, nyilvános `GET /api/session`; 5 hibás próba / 15 perc / IP → 429; web: login-oldal az app előtt, kilépés-gomb a fejlécben | Terv: `docs/plans/i31-web-login.md`. A mobil marad a Bearer tokennél. Visszavonás: a `SESSION_SECRET` cseréje minden eszközt kiléptet. |

Helyben igazolva (2026-11-25): a csomag sima Node 22 alatt betölt; token nélkül 401, rossz `CRON_SECRET`-tel 401, elérhetetlen
DB-nél 503. A valódi Supabase-en (Session pooler) a csomagon át: `/api/fixtures`, `/api/budget`, `/api/leagues`, `/api/backtest` 200, két egymás utáni no-op tick `ok` (a lock felszabadul). Ingyenes csomagon a projekt kb. 1 hét inaktivitás után szünetel → dashboard: Restore/Resume. Csak az első **preview** deploy dönti el:

- a Vercel a „Other” presetnél átveszi-e a `buildCommand` által írt `.vercel/output`-ot (a build-logban: nincs „No Output
  Directory” hiba, a Deployments → Functions alatt látszik az `/api`);
- a függvény az eredeti útvonalat látja-e a route után (C: a `/api/budget` a saját JSON-401-et adja, nem 404-et);
- a path-targetes schedule a `config.json`-ból felveszi-e magát (Settings → Schedules: `cron-tick`).

**Tartalék, ha a Build Output API nem megy:** `api/index.ts` (`export default { fetch: createVercelHandler({...}) }`),
`vercel.json`-ban `outputDirectory: frontend/build`, rewrite `/api/(.*)` → `/api/index` + SPA-rewrite, `functions` alatt
`includeFiles: data/*/*-v0.json` és `maxDuration`, `schedules` ugyanígy.

## B. Tulajdonosi lépések

### B1. Ág és fiók
1. **Production ág = `master`.** A Vercel a `master`-t deployolja productionbe, minden más ág (pl. `autodev`) preview-t kap.
   Sorrend: az I30 az `autodev`-on → projekt-import (B2) → az `autodev` **preview** deployján dőlnek el a fenti kockázatok →
   csak utána `autodev` → `master` merge (PR) = első production deploy.
2. Vercel-fiók: <https://vercel.com/signup> → *Continue with GitHub* → **Hobby** (ingyenes, csak nem kereskedelmi használat).

### B2. Projekt létrehozása (amint az I30 az `autodev`-on van)
1. Dashboard → **Add New… → Project** → *Import Git Repository* → `football-app` (ha nem látszik: *Adjust GitHub App
   Permissions*, és add hozzá a repót).
2. Beállítások az importnál:
   - **Root Directory:** a repó gyökere (`./`) – a `vercel.json` és a `scripts/vercel-build.mjs` a gyökérben van.
   - **Framework Preset:** *Other* (a `vercel.json` vezérel); Build/Output mezőket ne írd felül.
   - **Environment Variables:** itt még hagyd üresen, a B3-ban veszed fel (az első build így elbukhat – nem baj).
3. **Deploy.** A kapott domain: `https://<projekt>.vercel.app` – ezt írd be lent a C-be.

### B3. Környezeti változók (Settings → Environment Variables)
Mindegyik **Sensitive**, környezet: **Production** + **Preview**. Az értéket te írod be, ne küldd el chatben.

| Név | Honnan | Mire |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect → **Session pooler** URI (port 5432, jelszóval) – **nem** a Transaction pooler: a tick advisory lockja session-szintű, tranzakciós poolingnál szivárogna | DB (kérésenként egy rövid kapcsolat; a Session pooler kapcsolatkorlátja ezt bőven bírja egy felhasználóval) |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | A Vercel a klasszikus cron és a Schedules *path target* hívásánál automatikusan `Authorization: Bearer <CRON_SECRET>`-et küld (function targetnél nem) |
| `APP_API_TOKEN_HASH` | `npm run token -w @football/server` (a tokent tedd a mobilapp Beállításaiba) | Mobil / curl Bearer |
| `APP_PASSWORD_HASH`, `SESSION_SECRET` | `npm run password -w @football/server` (bekéri a jelszót kétszer, mindkét értéket kiírja; a saját terminálodban futtasd, ne chatben) | Web-login (I31) |

**Ne vedd fel:** `API_FOOTBALL_KEY` (csak a 3.7 💸 élesítéssel), semmilyen `VITE_*KEY`-t (bekerülne a böngésző-bundle-be).
`NODE_ENV`-et sem kell (a Vercel `production`-t ad). Env-változás után **Redeploy** kell (a `CRON_SECRET` build-időben rögzül).

### B4. Hozzáférés-védelem (Settings → Deployment Protection)
- **Vercel Authentication → „Standard Protection”** csak a preview-kat védi, a production domaint **nem**.
- **„All Deployments”** Hobby-n is elérhető, a productiont is védi – de akkor a mobilapp és egy külső pinger nem jut be
  (BLOCKERS 2026-11-13).
- **Javaslat:** Standard Protection + az app saját védelme (Bearer + session, productionben fail-closed). Ez eltér az
  `architecture.md` §6-tól, amely a productionre is Vercel Authenticationt tervezett (még a mobil-ADR előtt). 🔶 a te döntésed.

### B5. Ütemező (Settings → Cron Jobs / Schedules)
- A schedule a build által írt `.vercel/output/config.json`-ban van (`cron-tick`, `*/15 * * * *`, path `/api/cron/tick`,
  alapból POST). Hobby-n a **Schedules (béta)** 15 percenként futhat, a jitter mindig 15 perc (a klasszikus Cron Jobs Hobby-n
  csak naponta egyszer). **A preview-kon az új schedule alapból inaktív**, productionben aktív; preview-n kipróbálni:
  Settings → Schedules → *Run Schedule*, vagy `vercel schedules enable cron-tick --git-branch autodev --for 2h`.
- Ha a deploy elutasítja vagy nem fut:
- **Tartalék – külső pinger:** <https://cron-job.org> (ingyenes) → új job: URL `https://<domain>/api/cron/tick`, 15 perc,
  fejléc `Authorization: Bearer <CRON_SECRET>`. Ehhez a production nem lehet „All Deployments” védelem alatt.

## C. Ellenőrzés és visszaállás

```bash
D=https://<projekt>.vercel.app
curl --ssl-no-revoke -i $D/api/budget                                   # 1.6: 401 (vagy Vercel-login), token nélkül
curl --ssl-no-revoke -i -H "Authorization: Bearer <token>" $D/api/budget # 1.6: 200
curl --ssl-no-revoke -i $D/api/cron/tick                                # 401 (titok nélkül)
curl --ssl-no-revoke -i -H "Authorization: Bearer <token>" $D/api/backtest # 200 JSON: a .func-ba másolt pillanatkép (404 = rossz fájl-elrendezés)
curl --ssl-no-revoke -i $D/api/session                                 # 200 {"authenticated":false,"loginEnabled":true} (I31)
curl --ssl-no-revoke -i -X POST -H "content-type: application/json" -d '{"password":"rossz"}' $D/api/login # 401 "Hibás jelszó" (400 = a törzs nem ér el a függvényig)
# 503 "Az adatbázis nem érhető el" = DATABASE_URL hiányzik/rossz (Functions-log: a hiba szövege, a cím nélkül)
```

- Web: a `$D` betölt, login után a Kezdőlap adatot mutat; screenshot 1440 + 390 px.
- **1.7, 24 óra után** (Supabase SQL editor):
  `select status, count(*) from cron_run where started_at > now() - interval '24 hours' group by 1;` → kb. 96 `ok`
  (Hobby Schedules-nál a jitter miatt kevesebb is lehet), `locked` = átfedés, cél 0; `error` sor → a `error` oszlop.
- Logok: Vercel → Deployments → (deploy) → **Functions / Logs**.
- **Visszaállás:** Deployments → egy korábbi deploy → **Promote to Production** / *Instant Rollback*. Ütemező leállítása:
  a schedule törlése a `vercel.json`-ból + deploy (vagy a pinger kikapcsolása).
- Siker után: ROADMAP 1.6 / 1.7 `[x]`, a BLOCKERS vonatkozó sorai „Megoldva”.

## D. Agent-hozzáférés a Vercelhez (opcionális)

- **Vercel MCP (hivatalos, OAuth):** `claude mcp add --scope user --transport http vercel https://mcp.vercel.com`, majd a
  Claude Code-ban `/mcp` → bejelentkezés. Doksi-keresés, projektek, deployok, build-logok olvasására jó; env-kezelést a doksi
  nem említ.
- **Vercel CLI:** `! npx vercel login` (ezen a gépen `NODE_OPTIONS=--use-system-ca` kell), utána `npx vercel link`,
  `npx vercel logs`, `npx vercel deploy` (preview).
- A CLAUDE.md „Csak itt állj meg” szabálya szerint az agent magától **nem** deployol productionbe és nem állít be projektet; ezt
  a tulajdonos egy-egy sessionre kifejezetten engedélyezheti. Titkot az agent akkor sem lát és nem ír: azokat te viszed fel.

## Első deploy – tapasztalatok (2026-11-25)

- **GitHub-app:** a Vercel GitHub-integrációt a tulajdonos telepítette (*Only select repositories* → `football-app`); utána a
  projektet az agent hozta létre a Vercel MCP-vel (`create_git_project`, `deploy: false`), majd Framework *Other*, Node **22.x**.
- **Az első deploy productionbe ment**, pedig az `autodev`-ról jött (a projektnek még nem volt deployja); a következő push már
  preview lett. A production így egy `autodev`-commiton fut, amíg nem jön `master`-deploy.
- **Build Output API működik:** a `buildCommand` által írt `.vercel/output`-ot a Vercel átveszi; a függvény az eredeti
  útvonalat látja (token nélkül a saját JSON-401); SPA-fallback rendben; tokennel `/api/budget|fixtures|leagues|backtest` 200.
- **Régió:** alapból iad1 → `.vc-config.json` `regions: ['cdg1']` (a Supabase eu-west-3 mellett); a válasz `X-Vercel-Id`
  fejlécében `cdg1` látszik.
- **Schedule:** a `config.json` path-targetes `cron-tick` productionben azonnal aktív lett; 15 percenként `ok` sor a `cron_run`-ban.
- **Védelem:** a projekt alapból `all_except_custom_domains` Vercel Authenticationt kapott (a production `*.vercel.app` is
  védett). Az agent a védett címeket a Vercel MCP share linkjével (`_vercel_share`, 23 óra) tesztelte. B4 döntés nyitott.
