# Design system (élő dokumentum)

> Státusz: **kezdeti token-alap**. A Tailwind az egységes styling-alap és a design-tokenek otthona.
> Vizuális iránytű: `docs/design/odds-design.png` (sötét téma, brand vörös, amber accent).
> Ez a dokumentum a redesign-migráció közben bővül — a komponens-szintű szabályok (Button, Table, Card, állapotok) akkor kerülnek bele.

---

## Háttér

Korábban a styling SCSS Modules + részleges SCSS-tokenek (`src/theme/theme.scss`) volt, hardkódolt hexekkel keverve, spacing-/típusskála nélkül (lásd `docs/fe/ui-audit.md`). A Tailwind mostantól a tokenek egyetlen forrása. A `theme.scss` és az SCSS Modules a fokozatos migráció alatt **párhuzamosan élnek** — lásd `docs/fe/adr/0001-tailwind-as-styling-base.md`.

A setup részleteit (build-integráció, Preflight) az ADR írja le. Röviden: **react-scripts 5 natív Tailwind-támogatás** (nincs CRACO), és a Tailwind **Preflight (globális reset) egyelőre KI van kapcsolva**, hogy a meglévő UI vizuálisan változatlan maradjon a migráció előtt.

---

## Színtokenek

A `tailwind.config.js` `theme.extend.colors` alatt, **névvel** (nem arbitrary value). Használat: a kulcs a Tailwind színprefixek után jön (`bg-*`, `text-*`, `border-*`).

| Token (Tailwind kulcs) | Érték | Szerep | Példa utility |
|---|---|---|---|
| `bg` | `#14161C` | Oldal háttér (legsötétebb) | `bg-bg` |
| `surface` | `#1C1F27` | Kártya / panel felület | `bg-surface` |
| `surface-2` | `#1A1D24` | Másodlagos felület (pl. sor-csík) | `bg-surface-2` |
| `sidebar` | `#16181F` | Oldalsáv háttér | `bg-sidebar` |
| `brand` | `#C02434` | Márkaszín (vörös), aktív/elsődleges hangsúly | `bg-brand`, `text-brand` |
| `accent` | `#F5A623` | Kiemelés (amber), pozitív/odds hangsúly | `text-accent`, `bg-accent` |
| `text` | `#E8E9ED` | Elsődleges szövegszín | `text-text` |
| `text-muted` | `#9CA0AB` | Másodlagos szöveg | `text-text-muted` |
| `text-faint` | `#6E727D` | Halvány / placeholder szöveg | `text-text-faint` |
| `positive` | `#4ADE80` | Pozitív érték (pl. nyerő kimenet) | `text-positive` |
| `negative` | `#F87171` | Negatív érték (pl. vesztes kimenet) | `text-negative` |
| `border-subtle` | `rgba(255,255,255,0.08)` | Finom keret/elválasztó | `border-border-subtle` |

> Megjegyzés a `text` kulcsról: a `colors.text` egyedi színkulcs → a `text-text`, `text-text-muted`, `text-text-faint` osztályokat adja. A dupla `text-` szándékos, a design tokennevek megőrzése érdekében.

---

## Spacing- és típusskála

Szándékosan a **Tailwind default** skáláját használjuk (az audit mindkettő hiányát jelezte) — a `theme.extend` nem írja felül őket.

- **Spacing** (4px-alapú rács): `p-1`=4px, `p-2`=8px, `p-3`=12px, `p-4`=16px, `p-6`=24px, `p-8`=32px … (ugyanez `m-*`, `gap-*`, `space-*`). Teljes skála: <https://tailwindcss.com/docs/customizing-spacing#default-spacing-scale>
- **Típus**: `text-xs` (12px) … `text-sm` (14px) … `text-base` (16px) … `text-lg` (18px) … `text-xl` (20px) … `text-2xl` (24px) … Lásd <https://tailwindcss.com/docs/font-size>

Ha a redesign során egyedi értékre van szükség, előbb **tokent** vezessünk be a configban (ne arbitrary value-t a markupban).

---

## Komponens-szabályok (TBD — redesign-fázis)

Itt fognak landolni: Button (default/primary/disabled/loading), Table (fej/sor/hover/sticky), Card/StatItem, Modal (backdrop/focus), állapotok (loading/empty/error). A `docs/design/odds-design.png` a referencia.
