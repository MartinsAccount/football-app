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

## Konvenció: komponens-típusok

- **Presentational, stateless leaf-primitív** → **function component** (`src/components/ui/`).
- **Store-kötött / stateful** komponens → marad **class component + MobX** (`@inject`/`@observer`), a meglévő kódbázishoz illeszkedve.

## Preflight-off reset (FONTOS)

A Tailwind Preflight egyelőre KI van (lásd ADR 0001), ezért a böngésző natív elem-stílusai élnek. A redesignolt elemeknél a reseteket **helyben** kell megadni:
- `<a>` (pl. navbar tab): `no-underline`.
- `<button>`: `appearance-none border-0 cursor-pointer` + explicit `bg-*` (különben a natív világos gomb-háttér átüt).
- A globális `margin/padding/box-sizing` resetet a `Main.module.scss` `*` blokkja adja.

## Komponens-szabályok (1. redesign-fázis — Odds + app-shell)

A `docs/design/odds-design.png` a referencia. Az alábbi primitívek a `src/components/ui/` alatt élnek.

| Komponens | Osztályok / szabály |
|---|---|
| **Card** | `bg-surface border border-border-subtle rounded-xl` (konténer minden panelhez/táblához) |
| **StatCard** | `Card` + `p-5`; címke `text-sm text-text-muted`, érték `text-3xl font-semibold`; `accent` → az érték `text-accent`; opcionális `sub` → halvány alsó sor (`text-sm text-text-muted`, pl. százalék) |
| **Pill** | `bg-surface border border-border-subtle rounded-full px-3 py-1 text-sm text-text-muted` (Szezon, Fetch) |
| **Bar** | sín `h-1.5 bg-surface-2 rounded-full`, kitöltés `bg-accent` (`width: %`), mellette `text-text-muted` % |
| **SidebarItem** | megosztott liga-menüpont (Odds + Fixtures): leading ikon `h-4 w-4 rounded-[3px] border border-current`, aktív `bg-accent/10 text-accent font-medium`, inaktív `bg-transparent text-text-muted hover:bg-surface-2 hover:text-text` |
| **Navbar** (Main) | `sticky top-0 z-50 h-14 bg-surface border-b border-border-subtle`; brand-badge `h-7 w-7 rounded-md bg-brand`; tab inaktív `text-text-muted no-underline`, aktív `text-text border-b-2 border-brand` |
| **Sidebar** | `w-64 bg-sidebar border-r border-border-subtle`; szekció-címke `text-xs uppercase text-text-faint`; a menüpontok `SidebarItem`-ek |
| **Primary gomb** | `bg-accent text-bg font-semibold rounded-lg hover:opacity-90` (+ a button-reset osztályok) |
| **Table** | `Card`-ban; fejléc `text-text-muted border-b border-border-subtle`; sor `border-b border-border-subtle hover:bg-surface-2`; nyerő szám `text-positive`, vesztes `text-negative`, döntetlen `text-text-muted`; hiányzó érték „—" |
| **Üres állapot** | `Card` középre zárt címmel (`text-lg font-semibold`) + magyarázó `text-sm text-text-muted` |

### Állapot
- ✅ 1. fázis: Odds oldal + app-shell (navbar).
- ✅ 2. fázis: Fixtures (Meccs statisztikák) oldal — sidebar (`SidebarItem`), header + `StatCard`-rács, üres állapot; `CustomStat` megszűnt, a debug „Teszt log" és a törött „Összes" gomb eltávolítva.

### Még hátralévő (későbbi fázisok)
- **Arbitrage** oldal tartalmának migrálása (most még régi SCSS, az új navbar alatt).
- Modal backdrop + focus-trap, aria/billentyűzet (audit #1) — az Arbitrage migrációval.
- A teljes migráció végén: **Preflight bekapcsolása** és a `theme.scss` leépítése.
