# ADR 0001 — Tailwind mint egységes styling-alap

- **Státusz:** Elfogadva
- **Dátum:** 2026-06-18
- **Kontextus forrása:** `docs/fe/ui-audit.md`, `docs/design/odds-design.png`

## Kontextus

A UI-audit (`docs/fe/ui-audit.md`) megállapította, hogy a `tailwindcss@3.3.5` fel volt véve devDependency-nek, de teljesen halott (nincs config, nincs `@tailwind` direktíva, nincs utility). A styling SCSS Modules + részleges SCSS-tokenek (`src/theme/theme.scss`) volt, hardkódolt hexekkel keverve, spacing-/típusskála nélkül. Egységes design-token-forrásra és egy fenntartható styling-alapra van szükség a tervezett redesignhoz.

## Döntés

A **Tailwind CSS** lesz az egységes styling-alap és a design-tokenek otthona. A tokeneket a `tailwind.config.js` `theme.extend` alatt, **névvel** definiáljuk (a paletta a `docs/design/odds-design.png`-ből); a spacing-/típusskála a Tailwind defaultja. A tokeneket a `docs/fe/design-system.md` dokumentálja.

A paletta **tudatosan felülírja** a `theme.scss` régi értékeit — különösen:
- `$navColor: #801414` → `brand: #C02434`
- `$orange: #ff9e00` → `accent: #F5A623`

A `theme.scss` és az SCSS Modules **NEM kerül törlésre** — a fokozatos migráció alatt párhuzamosan élnek. A komponensek átírása és a régi SCSS leépítése külön, későbbi lépés.

## Build-integráció — fontos eltérés a tervezett megközelítéstől

A jóváhagyott terv **react-scripts 5 + CRACO**-t irányzott elő (mert a régi CRA 4 PostCSS 7 pipeline-ja nem tudja futtatni a Tailwind 3-at, ami PostCSS 8 plugin). Implementáció közben kiderült:

1. A **react-scripts 5-nek beépített (natív) Tailwind-támogatása van**: ha érzékel egy `tailwind.config.js`-t az app gyökerében (`useTailwind` flag a `react-scripts/config/webpack.config.js`-ben), automatikusan beilleszti a `tailwindcss` plugint a saját PostCSS-láncába. **CRACO tehát NEM szükséges.**
2. A **CRACO ráadásul el is rontotta** a dev-pipeline-t: a `@craco/craco@7` saját, beégetett CRA-plugin-listája korábbi, mint a CRA 5 natív Tailwind-ága, így a `@tailwind` direktívák feldolgozatlanul (literálisan) jutottak a böngészőbe.

**Végső döntés:** **react-scripts 4 → 5 upgrade, CRACO NÉLKÜL** (natív CRA-támogatás). Igazolva: tiszta `react-scripts build` a kimeneti CSS-be legenerálja a Tailwind utility-ket, és nem szivárog literális `@tailwind` direktíva.

### Preflight kikapcsolva (egyelőre)

A Tailwind **Preflight** (globális reset) **KI van kapcsolva** (`corePlugins.preflight: false`), hogy a setup-fázisban az app vizuálisan változatlan maradjon (a Preflight nullázná pl. a `h1..h6`, `ul`, `button` stílusokat). A redesign-fázisban kontrollált módon kapcsoljuk vissza. A meglévő `Main.module.scss` `* { margin:0; box-sizing }` reset marad érvényben.

### `ajv@8` pin

A `react-scripts@5` (webpack 5) build a `schema-utils` → `ajv-keywords@5`-ön keresztül **ajv 8**-at igényel, de a `--legacy-peer-deps` telepítés (amit a meglévő `mobx-react@5` ↔ `react@17` peer-konfliktus tesz szükségessé) felül `ajv 6`-ot hoisztolt → `Cannot find module 'ajv/dist/compile/codegen'`. Ezt egy explicit `ajv@^8.12.0` devDependency pin oldja meg (az eslint a saját nested ajv 6-ját kapja).

## Következmények

**Pozitív**
- Tailwind 3 működik egy támogatott pipeline-on; teljes webpack-integráció + HMR.
- A react-scripts 5 / webpack 5 megszünteti a CRA 4 / Node 22 `--openssl-legacy-provider` kényszerét is.
- Kevesebb függőség és kevesebb mozgó alkatrész (nincs CRACO, nincs `craco.config.js`).

**Negatív / kockázat**
- react-scripts major upgrade (webpack 4 → 5). Igazolva: a build és a három útvonal (`/odds`, `/fixtures`, `/arbitrage`) változatlanul renderel.
- A `--legacy-peer-deps` továbbra is kell (pre-existing `mobx-react@5` ↔ `react@17` peer-konfliktus miatt).

## Érintett fájlok

- `frontend/package.json` — `react-scripts@5.0.1`, `ajv@^8.12.0` + `tailwindcss` (devDeps), scriptek maradnak `react-scripts`.
- `frontend/tailwind.config.js` — content glob, `theme.extend.colors`, `corePlugins.preflight: false`.
- `frontend/src/index.css` — `@tailwind base/components/utilities` direktívák.
- `docs/fe/design-system.md` — token-dokumentáció.

## Alternatívák (elvetve)

- **Tailwind standalone CLI** (külön build/watch lépés, CRA 4 érintetlen): kisebb tooling-kockázat, de két dev-folyamat, nincs class-HMR; a natív CRA 5 támogatás ezt feleslegessé teszi.
- **Tailwind 2 `@tailwindcss/postcss7-compat`** CRA 4-en: ellentmond a `tailwindcss@3.3.5` pinnek és a v3 funkcióknak.
- **react-scripts 5 + CRACO** (eredeti terv): a CRACO felesleges és elrontotta a dev Tailwind-feldolgozást.
