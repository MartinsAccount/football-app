# ADR 0008 — Repó-szerkezet: npm workspaces + `packages/core`

- **Státusz:** Elfogadva (2026-11-12) — a tulajdonos a repó-szerkezetet az agentre bízta
- **Dátum:** 2026-11-12
- **Kapcsolódó:** ADR-0007 · [`architecture.md` §8.1](../architecture.md) · ROADMAP 0.8

## Kontextus

A frontendnek és a leendő API-nak (Vercel-függvények, ütemezett jobok) ugyanazt a
domain-logikát kell használnia: odds-típusok, arbitrázs, később feature-ök, modellek,
kiértékelés. Agentic fejlesztésnél egy paranccsal kell telepíteni, futtatni és ellenőrizni
az egészet.

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | Külön csomagok gyökér-tooling nélkül (eddig) | egyszerű | duplikált logika, több `npm install`, nincs közös `verify` |
| B | **npm workspaces**, a meglévő `frontend/` és `backend/` marad, új `packages/*` | kis átrendezés, egy install és egy `verify`, közös core | a hoisting miatt a CRA nem ment volna (→ ADR-0007) |
| C | `apps/*` + `packages/*` átnevezéssel, Turborepo/pnpm | „szabványos” monorepo | felesleges churn és új eszköz egy egyfejlesztős projekthez |

## Döntés

**B.** Gyökér `package.json` workspaces-szel (`packages/*`, `frontend`, `backend`), egy
lockfile, gyökér scriptek (`dev`, `verify`, `test`, `format`). A `@football/core` TS-forrásként
exportál (`exports: ./src/index.ts`), build nélkül — a Vite és a Vitest közvetlenül fordítja.

## Következmények

- A core **szigorú TS** (`strict`, `strictNullChecks`), és nincs benne I/O: minden számoló
  logika ide kerül, tesztekkel.
- A frontend régi import-útvonalai (`core/models`, `core/constants/BetTypes`) továbbexportálnak
  a core-ból, így a meglévő kód nem változott.
- Az API (Vercel `api/`) Node-ból fogja használni a core-t → ott egy TS-futtató/bundler kell
  (a Vercel függvény-buildje ezt adja); ez az 1. fázisban dől el.
