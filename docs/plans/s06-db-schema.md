# S06 – DB-séma v1 (ROADMAP 1.3, architecture.md §10)

## Cél

Postgres-migrációk (Supabase-kompatibilis, standard PG ≥ 15) a teljes §10 adatmodellre, idempotensen, élő DB nélkül tesztelve.

## Lépések

1. Új workspace `packages/db` (`@football/db`): `migrations/0001–0005_*.sql` (törzsadat, meccsek, odds, modell, üzem).
2. Minden DDL `IF NOT EXISTS` / `CREATE OR REPLACE` / `DROP TRIGGER IF EXISTS`; a seed `ON CONFLICT DO NOTHING`.
3. `prediction` append-only triggerrel (UPDATE/DELETE tilos; kivétel: a hivatkozott snapshot törlésekor a FK nullázása).
4. `api_budget_day` CHECK-ekkel (`daily_limit ≤ 100`, `used ≤ daily_limit`) + `api_budget_reserve(day, cap)` atomikus foglalás.
5. `src/migrate.ts`: futtató `schema_migration` naplóval és checksum-őrrel (`SqlExecutor`: PGlite / később `pg`).
6. Teszt PGlite-tal (WASM Postgres, devDependency): üres DB → minden tábla; 2. futás no-op; nyers újrafuttatás is hibátlan;
   append-only; budget soha > 100.

## Kimarad (BLOCKERS / későbbi szelet)

- Valódi Supabase-bekötés és `db:migrate` CLI `DATABASE_URL`-lel (nincs Supabase-adat a `.env`-ben).
- Repository-interfész + adapter: S07.
