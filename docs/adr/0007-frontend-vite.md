# ADR 0007 — Frontend toolchain: Vite + Vitest (CRA kivezetése)

- **Státusz:** Elfogadva (2026-11-12) — a tulajdonos a repó-szerkezetet az agentre bízta
- **Dátum:** 2026-11-12
- **Kapcsolódó:** PRD D5 · [`architecture.md` §9](../architecture.md) · ROADMAP 0.7

## Kontextus

- A Create React App-et a React csapata 2025 februárjában kivezette.
- A CRA csak az `src/`-n belüli TS-t fordítja, így a frontend és a backend/API közös
  tiszta logikája (`packages/core`) nem importálható → a workspaces-alapú szerkezet (ADR-0008)
  CRA mellett nem működik.
- Agentic fejlesztésnél a gyors, determinisztikus `verify` (typecheck + teszt + build) a fő
  visszacsatolás; a CRA lassú, és a TS-verziót 4.x-en tartotta.

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | CRA marad | nincs munka | halott eszköz, nincs közös csomag, TS 4.x |
| B | **Vite + Vitest**, MobX v5 és React 17 marad | gyors dev/build/teszt, TS 5, workspaces-képes, kis kockázat | a MobX v5 dekorátorokhoz extra konfig |
| C | Next.js | API és UI egy projektben | nagy átírás (routing, class komponensek), most nem indokolt |

## Döntés

**B: Vite 5 + Vitest 2 + TypeScript 5.6**, a React 17 / MobX v5 / class komponensek
változatlanok. A MobX 6 / React 18 frissítés külön szelet (ROADMAP 9.2).

## Következmények

- `REACT_APP_*` → `VITE_*` env-változók (`import.meta.env`, típusok: `src/vite-env.d.ts`).
- Dekorátorok: `tsconfig` `experimentalDecorators: true` + `useDefineForClassFields: false`,
  és a plugin-react Babel-je `decorators-legacy` parser-plugint kap — e nélkül dev módban az
  app nem renderel.
- A `require('*.json')` dinamikus `import()` lett → az adatfájlok külön chunkba kerülnek.
- Nincs ESLint (a CRA beépítettje megszűnt); szükség esetén külön szelet.
- `npm run verify` = typecheck + prettier check + vitest + build.
