# ADR 0009 — Tailwind + Floodlight komponens-CSS (v0.2)

- **Státusz:** Accepted (agent) – review pending
- **Dátum:** 2026-11-13
- **Kapcsolódó:** ADR-0001 (kiegészíti) · `docs/plans/redesign-floodlight-v0.2.md` · CHANGES 0. · S25

## Kontextus

A Floodlight v0.2 csomag saját `tokens.css`-t (sötét alap + `[data-theme="light"]` felülírás) és `components.css`-t
(oe-* osztályok, `[aria-*]`/`[data-*]` állapotokkal) hoz. Az app 2025 óta Tailwindet használ (ADR-0001), a theme már
`var(--…)`-ra mutat (S02). A v0.2 `components.css`-ből több v0.1-es, az appban használt osztály kiesett (oe-card, oe-stat,
oe-sheet, oe-slipbar stb.).

## Opciók

| | Opció | Előny | Hátrány |
|---|---|---|---|
| A | components.css vendor, oe-* közvetlenül + appsaját elemek Tailwind-utilityvel | a csomag fájlcserével frissíthető; egy forrás a kinézetre | két stílus-réteg |
| B | components.css átírása Tailwind `@apply`-ra | egy réteg | minden csomag-frissítés kézi újraírás |
| C | saját kiegészítő CSS-fájl a kieső osztályokhoz | gyors | harmadik réteg, elsodródik a csomagtól |

## Döntés

**A.** A `tokens.css` (generált, forrás `tokens.json` + `tokens.light.json`) a téma alapja; a `data-theme` a `<html>`-en.
A Tailwind theme minden színe, betűmérete, rádiusza, térköze (`sp-N`, `touch`, `control`…) `var(--…)`-ra mutat, így a
Tailwind-osztályok is követik a témát. A `components.css` változatlan vendor-fájl; a referencia oe-* osztályait közvetlenül
használjuk. A csomagban nem szereplő, appsaját elemek (mobil alsó lap, szelvény-sáv, kártya, beviteli mező stb.) Tailwind-
utilityvel készülnek, a közös osztálylisták a `frontend/src/components/ui/oeClasses.ts`-ben. Új saját CSS-fájl nincs.
Döntötte: agent (autonóm munkamód), a tulajdonos felülvizsgálhatja.

## Következmények

- ADR-0001 érvényes marad; ez kiegészíti a Floodlight komponens-réteggel.
- Nyers szín/px csak a `design/tokens` (generált) és a vendor `design/components` alatt lehet (CHANGES 0. grep).
- A csomag új verziója: a három token-forrás + `components.css` cseréje, `npm run tokens`, majd a kieső osztályok grep-je.
