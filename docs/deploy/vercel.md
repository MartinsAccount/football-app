# Vercel-deploy és ütemező – runbook (ROADMAP 1.6, 1.7)

> Állapot: 2026-11-24. **Még egyszer sem futott le** – az első deploy után javítsd, ahol eltér a valóságtól. A Vercel-tények
> forrása a vercel.com/docs (2026-11-24-i olvasás); ahol ⚠️ áll, ott a doksi ellentmondásos vagy nem ellenőrzött.

Három rész: **A** – kód-előfeltételek (agent-szeletek, ezek nélkül a deploy nem működik), **B** – tulajdonosi lépések (fiók,
projekt, titkok), **C** – ellenőrzés és visszaállás.

## A. Kód-előfeltételek (még nincsenek kész)

A repóban ma **nincs** `api/` mappa és `vercel.json`, és a webes kliens nem tud bejelentkezni. Sorrendben:

| Szelet | Mit | Megjegyzés |
|---|---|---|
| **I30 – 1.6a Vercel-belépési pont** | `api/[...path].ts` (catch-all) → `createApiHandler({...})`, valódi Postgres (`DATABASE_URL`), `auth: authConfigFromEnv`, `cron: createCronHandler({ store, config })` **worker nélkül** (no-op tick); `vercel.json`: `buildCommand`, `outputDirectory: frontend/build`, SPA-rewrite (`/((?!api/).*)` → `/index.html`), `maxDuration: 300`, 15 perces schedule | Ne a `dev.ts`-t másold: ott a `createDbIngestWorker` **mock** klienst kap → mock adat kerülne az éles Supabase-be. Élő ingestion = 3.7 💸, külön. |
| **I31 – 1.6b Web-login (session cookie)** | `POST /api/login` (jelszó → `APP_PASSWORD_HASH`), httpOnly + Secure + SameSite=Strict cookie (`SESSION_SECRET`), `Authorizer` a `auth.ts` bővítési pontján, login-oldal a weben, rate limit | Ma a web `createApiClient({ baseUrl: '' })` tokent nem küld, productionben (`NODE_ENV=production`) pedig hash nélkül **minden** `/api/*` 401 → a web e nélkül üres. |

Kockázatok, amelyeket az első **preview** deploy dönt el:

- **Bundling:** a workspace-csomagok TS-forrásként mennek (`exports: ./src/index.ts`); a Vercel Node-buildernek ezt le kell
  fordítania. Az `openTarget` a PGlite-ot is behúzza → a belépési pont közvetlenül a pg-megnyitót hívja.
- **Fájlrendszer:** `fileSnapshotSource(data/)` és `loadIngestMocks` lemezről olvas → a függvényben csak DB-forrás legyen
  (vagy `includeFiles`).
- **Supabase serverlessből:** a **pooler** connection stringet használd (Supabase → Connect → *Transaction pooler*, port 6543),
  ne a direktet; a pg-kliens prepared statementjeit ellenőrizni kell vele.

## B. Tulajdonosi lépések

### B1. Ág és fiók
1. **Production ág = `master`.** A Vercel a `master`-t deployolja productionbe, minden más ág (pl. `autodev`) preview-t kap.
   Az A-szeletek után: `autodev` → `master` merge (PR).
2. Vercel-fiók: <https://vercel.com/signup> → *Continue with GitHub* → **Hobby** (ingyenes, csak nem kereskedelmi használat).

### B2. Projekt létrehozása (az A-szeletek merge-e után)
1. Dashboard → **Add New… → Project** → *Import Git Repository* → `football-app` (ha nem látszik: *Adjust GitHub App
   Permissions*, és add hozzá a repót).
2. Beállítások az importnál:
   - **Root Directory:** a repó gyökere (`./`) – az `api/` a gyökérben van.
   - **Framework Preset:** *Other* (a `vercel.json` vezérel); Build/Output mezőket ne írd felül.
   - **Environment Variables:** itt még hagyd üresen, a B3-ban veszed fel (az első build így elbukhat – nem baj).
3. **Deploy.** A kapott domain: `https://<projekt>.vercel.app` – ezt írd be lent a C-be.

### B3. Környezeti változók (Settings → Environment Variables)
Mindegyik **Sensitive**, környezet: **Production** + **Preview**. Az értéket te írod be, ne küldd el chatben.

| Név | Honnan | Mire |
|---|---|---|
| `DATABASE_URL` | Supabase → Connect → Transaction pooler URI (jelszóval) | DB |
| `CRON_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | A Vercel a schedule-hívásnál automatikusan `Authorization: Bearer <CRON_SECRET>`-et küld |
| `APP_API_TOKEN_HASH` | `npm run token -w @football/server` (a tokent tedd a mobilapp Beállításaiba) | Mobil / curl Bearer |
| `APP_PASSWORD_HASH`, `SESSION_SECRET` | az I31 ad hozzá generáló scriptet | Web-login |

**Ne vedd fel:** `API_FOOTBALL_KEY` (csak a 3.7 💸 élesítéssel), semmilyen `VITE_*KEY`-t (bekerülne a böngésző-bundle-be).
`NODE_ENV`-et sem kell (a Vercel `production`-t ad). Env-változás után **Redeploy** kell (a `CRON_SECRET` build-időben rögzül).

### B4. Hozzáférés-védelem (Settings → Deployment Protection)
- **Vercel Authentication → „Standard Protection”** csak a preview-kat védi, a production domaint **nem**.
- **„All Deployments”** Hobby-n is elérhető, a productiont is védi – de akkor a mobilapp és egy külső pinger nem jut be
  (BLOCKERS 2026-11-13).
- **Javaslat:** Standard Protection + az app saját védelme (Bearer + session, productionben fail-closed). 🔶 a te döntésed.

### B5. Ütemező (Settings → Cron Jobs / Schedules)
- A `vercel.json` 15 perces schedule-t kér. ⚠️ A doksi ellentmondásos: a klasszikus Cron Jobs Hobby-n **naponta egyszer**
  (±59 perc), az új **Schedules (béta)** Hobby-n **15 percenként** (15 perc jitterrel). Ha a deploy elutasítja vagy nem fut:
- **Tartalék – külső pinger:** <https://cron-job.org> (ingyenes) → új job: URL `https://<domain>/api/cron/tick`, 15 perc,
  fejléc `Authorization: Bearer <CRON_SECRET>`. Ehhez a production nem lehet „All Deployments” védelem alatt.

## C. Ellenőrzés és visszaállás

```bash
D=https://<projekt>.vercel.app
curl --ssl-no-revoke -i $D/api/budget                                   # 1.6: 401 (vagy Vercel-login), token nélkül
curl --ssl-no-revoke -i -H "Authorization: Bearer <token>" $D/api/budget # 1.6: 200
curl --ssl-no-revoke -i $D/api/cron/tick                                # 401 (titok nélkül)
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
