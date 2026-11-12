# Design system (élő dokumentum)

> Státusz: **kezdeti token-alap**. A Tailwind az egységes styling-alap és a design-tokenek otthona.
> Vizuális iránytű: `docs/design/odds-design.png` (sötét téma, brand vörös, amber accent).
> Ez a dokumentum a redesign-migráció közben bővül — a komponens-szintű szabályok (Button, Table, Card, állapotok) akkor kerülnek bele.

---

## Háttér

Korábban a styling SCSS Modules + részleges SCSS-tokenek (`src/theme/theme.scss`) volt, hardkódolt hexekkel keverve, spacing-/típusskála nélkül (lásd `docs/fe/ui-audit.md`). A Tailwind mostantól a tokenek egyetlen forrása. A `theme.scss` és az SCSS Modules a fokozatos migráció alatt **párhuzamosan élnek** — lásd `docs/adr/0001-tailwind-as-styling-base.md`.

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

## Globális reset: Preflight BE

A Tailwind **Preflight BE van kapcsolva** (a záró fázis óta) — ez adja az egységes globális alap-resetet (`box-sizing`, margók, címsor/gomb/link normalizálás). Nincs külön globális SCSS reset, és nincs `theme.scss`.

- A címsorokat mindig explicit utility-vel méretezzük (`text-2xl font-semibold` stb.), mert a Preflight a natív méretet/súlyt nullázza.
- A migráció alatt hozzáadott helyi resetek (`no-underline` a linkeken, `appearance-none border-0` a gombokon) a Preflight mellett **redundánsak, de ártalmatlanok** — maradhatnak.

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
| **Button** | megosztott gomb (`MyButton` helyett); `variant`: primary `bg-accent text-bg`, secondary `bg-surface border-border-subtle text-text-muted hover:bg-surface-2`; `active` → `bg-accent/10 border-accent text-accent` |
| **ModalShell** | hozzáférhető modál-burok: backdrop `fixed inset-0 bg-black/60` (kattintásra zár), `role="dialog" aria-modal`, Esc-re zár, fókusz a panelen + Tab focus-trap, záráskor a fókusz visszaáll, „×" `aria-label="Bezárás"` |
| **Lenyíló szűrő** (sidebar) | a blokk-fejléc `<button aria-expanded>` + forgó chevron; az opciók `<label><input class="accent-accent">` (radio = egyszeres, checkbox = többszörös) |
| **Table** | `Card`-ban; fejléc `text-text-muted border-b border-border-subtle`; sor `border-b border-border-subtle hover:bg-surface-2`; pozitív/profitábilis érték `text-accent`/`bg-accent/15`, nyerő `text-positive`, vesztes `text-negative`, semleges `text-text-muted`; hiányzó érték „—" |
| **Üres állapot** | `Card` középre zárt címmel (`text-lg font-semibold`) + magyarázó `text-sm text-text-muted` |

### Állapot
- ✅ 1. fázis: Odds oldal + app-shell (navbar).
- ✅ 2. fázis: Fixtures (Meccs statisztikák) oldal — `SidebarItem`, `StatCard`-rács, üres állapot; `CustomStat` + debug gomb eltávolítva.
- ✅ 3. fázis: Arbitrage oldal — `Button` (kiváltja a `MyButton`-t), `ModalShell` (a11y modálok), mindkét nézet (táblázat + fogadástípus) Tailwindre, szűrő-sidebar `aria-expanded`-del, magyar feliratok. Az `index===0`-thead trükk és az inline-style is megszűnt.

- ✅ Záró fázis: **Preflight bekapcsolva**; a `theme.scss`, a `Main.module.scss` `*`-reset, az `App.css` és a `LoadingScreen` SCSS-e megszűnt (a `LoadingScreen` is Tailwindre került). Nincs több `*.module.scss`/`theme.scss` — csak az `index.css` a `@tailwind` direktívákkal.

### Kész
A teljes UI a sötét, token-alapú Tailwind design-rendszeren van; a régi SCSS-réteg leépítve.
