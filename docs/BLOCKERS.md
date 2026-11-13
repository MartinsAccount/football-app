# Blokkolók

| Dátum | Mi kell | Miért | Mit csinálnék |
| --- | --- | --- | --- |
| 2026-11-12 | Supabase-projekt + `DATABASE_URL` (szerveroldali env, Vercel Marketplace-integráció) | A `.env`-ben nincs Supabase-adat; projekt-beállítás és titok = tulajdonosi lépés | `pg` kliens + `npm run db:migrate -w @football/db` (a `migrate()` a `SqlExecutor`-on át), egyszeri futás a valódi DB-n, majd a Postgres-adapter (S07 utódja) |
| 2026-11-13 | APK-build az `apps/mobile`-ból | Ingyenes Expo-fiók (EAS) vagy lokális Android SDK + JDK kell – fiók-regisztráció / telepítés = tulajdonosi lépés | `npx eas-cli login`, `eas build:configure` (`preview` profil `buildType: apk`), `npx eas-cli build -p android --profile preview`; vagy `npx expo prebuild -p android` + `gradlew assembleRelease` (lásd `apps/mobile/README.md`) |
| 2026-11-13 | Éles API elérése mobilról | A Vercel Authentication böngészős SSO, a natív app nem jut át rajta; a leendő Vercel `api/` belépési pontnak `createApiHandler({ ..., auth: authConfigFromEnv(process.env) })`-et kell kapnia, és az `APP_API_TOKEN_HASH` env beállítása titok = tulajdonosi lépés | a production-domainen a Vercel Authentication kikapcsolása (vagy bypass) a `/api/*`-ra, `APP_API_TOKEN_HASH` a Vercel env-be (`npm run token -w @football/server`), a token az app Beállításaiba |
