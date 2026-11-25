# S05 – App shell (ROADMAP B, DESIGN §7.1–7.2, §13)

## Cél

Új keret az M1 oldalaihoz: AppShell (AppHeader + konténer), PageIntro, új route-ok üres állapottal.

## Lépések

1. Core: `formatDayHeading` (`Csütörtök, november 12.`) a PageIntro dátumához, teszttel.
2. `components/AppShell/AppHeader.tsx`: `.oe-header` / `.oe-brand` / `.oe-nav` (NavLink → `aria-current`), jobbra `.oe-status`
   (fixture → `stale` „Mentett adat”, live → `fresh`) + `N/100 hívás`.
3. `components/AppShell/AppShell.tsx`: `.oe-container`, LoadingScreen, AppHeader, `<main>`.
4. `components/PageIntro/PageIntro.tsx` (+ `EmptyState.tsx`): dátum, kétsoros h1, opcionális aside (ModeSwitch később).
5. Oldalak: `/` RecommendationsPage, `/evaluation`, `/settings` – PageIntro + EmptyState.
6. `Main.tsx`: route-ok; `/odds`, `/fixtures` → `/`; régi nézetek `/legacy/odds|fixtures` alatt, link nélkül; ismeretlen → `/`.

## Ellenőrzés

`npm run verify`; screenshot 1440 és 390 (`/`, `/evaluation`, `/arbitrage`).

## ui-audit

#4 (nincs `/` / üres állapot) → kész. #12 (debug a UI-ban): „Fetch #” pill → hívás-státusz; a „Teszt log” és a render-beli
`console.log` már nincs a kódban.
