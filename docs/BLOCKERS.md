# Blokkolók

| Dátum | Mi kell | Miért | Mit csinálnék |
| --- | --- | --- | --- |
| 2026-11-12 | Supabase-projekt + `DATABASE_URL` (szerveroldali env, Vercel Marketplace-integráció) | A `.env`-ben nincs Supabase-adat; projekt-beállítás és titok = tulajdonosi lépés | `pg` kliens + `npm run db:migrate -w @football/db` (a `migrate()` a `SqlExecutor`-on át), egyszeri futás a valódi DB-n, majd a Postgres-adapter (S07 utódja) |
