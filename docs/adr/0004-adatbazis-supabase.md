# ADR 0004 — Adatbázis: Supabase Postgres

- **Státusz:** Elfogadva (2026-11-12, tulajdonos) — az ORM (Drizzle javaslat) külön, az 1.3 szeletnél dől el
- **Dátum:** 2026-11-12
- **Kapcsolódó:** PRD D3 · [`architecture.md` §4, §4.1, §10](../architecture.md) · ROADMAP 1.3

## Kontextus

Tartós tár kell a meccseknek, az odds-snapshotoknak, a predikcióknak és a kiértékelésnek,
ingyenes csomagban. Az elemzéshez Postgres-funkciók kellenek (`jsonb`, ablakfüggvények).

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | **Supabase Free** | a tulajdonos ismeri és máshol is használja; admin felület; opcionális Auth | 500 MB; 1 hét inaktivitás után szünetel; max. 2 aktív projekt/szervezet |
| B | Neon Free | 1 GB; nem szünetel; branch-ek | új eszköz; havi 100 CU-óra |

## Döntés

**Supabase Postgres.** Az 500 MB a konfigurálható tárolási szabályokkal (követett ligák,
tárolt piacok és irodák, nyitó + záró snapshot) bőven elég.

## Következmények

- Szabványos Postgres SQL, Supabase-specifikus funkcióra nem építünk → Neonra váltás egy
  `DATABASE_URL` csere + migrációk.
- Amíg nincs ütemezett írás, a projekt egy hét után szünetel → a dashboardon kell indítani.
- A tárolási szabályok kötelezőek (`architecture.md` §4.1).
