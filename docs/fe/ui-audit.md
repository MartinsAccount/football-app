# Frontend UI audit

> Állapot: **audit only** — ez a dokumentum csak leltároz és értékel, kódot **nem** módosít.
> Dátum: 2026-06-12 · Hatókör: `frontend/src` (CRA + TypeScript + MobX v5)

---

## 1. Módszertan és hatókör

A `frontend/src` alatt minden `*.tsx` komponens és `*.scss` modul átolvasva. A futó appot nem indítottam el; a megállapítások a forráskódból (markup + stílus) származnak. A statikus elemzés kiegészíthető Playwrighttal (vizuális/akadálymentességi futás) — lásd a 7. szakaszt.

A repó **kétcsomagos monorepo**; ez az audit kizárólag a `frontend` UI-jával foglalkozik (a backend Express API nem érintett).

---

## 2. Képernyők és komponensek leltára

Az app egy fix felső navigációból és három útvonalból áll (`Main.tsx:48-58`), `react-router-dom` v5 `Switch`/`Route` használatával. Nincs `/` alapútvonal vagy redirect — induláskor üres tartalom látszik, amíg a felhasználó nem kattint egy menüpontra.

| Útvonal | Oldal | Sidebar | Tartalom | Modál(ok) |
|---|---|---|---|---|
| `/odds` | `OddsPage` | `OddsSidebar` (liga-választó + mentés gombok) | `OddsContent` → táblázat `RowItem` sorokkal | — |
| `/fixtures` | `FixturePage` | `FixtureSidebar` (liga statisztika gombok) | `FixtureContent` → `CustomStat` kártyák | — |
| `/arbitrage` | `ArbitragePage` | `ArbitrageSidebar` (filterek, dropdownok, checkboxok) | `ArbitrageContent` → táblázat / „bet type" lista nézet | `Modal`, `FixtureInformationModal` |

### Komponensfa

```
App (Provider: MainStore)
└─ Main                         components/Main/Main.tsx
   ├─ LoadingScreen             components/LoadingScreen/         (globális overlay spinner)
   ├─ nav (navbar)              inline a Main-ben
   └─ Switch
      ├─ OddsPage               pages/OddsPage/
      │  ├─ OddsSidebar         └─ components/OddsSidebar/        → MyButton ×7
      │  └─ OddsContent         └─ components/OddsContent/        → table → RowItem (OddsPage saját)
      ├─ FixturePage            pages/FixturePage/
      │  ├─ FixtureSidebar      └─ components/FixtureSidebar/     → MyButton ×7 (köztük "Teszt log")
      │  └─ FixtureContent      └─ components/FixtureContent/     → CustomStat (statisztika kártya) ×11
      └─ ArbitragePage          pages/ArbitragePage/
         ├─ ArbitrageSidebar    └─ components/ArbitrageSidebar/   → MyButton ×2 + 5 dropdown filter blokk
         └─ ArbitrageContent    └─ components/ArbitrageContent/   → table → RowItem (Arbitrage saját)
            ├─ Modal            └─ components/Modal/              (legmagasabb odds-ok táblája)
            └─ FixtureInformationModal  components/FixtureInformationModal/
```

### Megosztott / újrahasznosított komponensek

- **`MyButton`** (`components/MyButton/MyButton.tsx`) — az egyetlen valódi újrahasznált UI-primitív. Két variáns (`default` / `primary`), `active` állapot. **De**: nincs `disabled`, `loading` vagy `size` támogatás, és `<button>` típusa nincs megadva (alapból `submit`).
- **`RowItem`** — **két külön, nem megosztott** implementáció létezik (`OddsPage/components/RowItem` és `ArbitragePage/components/RowItem`), eltérő modellel és markuppal. Névütközés, nem közös absztrakció.
- **SVG-k** (`assets/ArrowRightSvg`, `ArrowDownSvg`) — inline ikonok, csak az Arbitrage sidebar dropdownjaiban.

---

## 3. Jelenlegi styling-megközelítés

| Réteg | Mit használ | Megjegyzés |
|---|---|---|
| Komponens-könyvtár | **Nincs** (se MUI, se Chakra, se Ant) | Minden UI kézzel írt |
| Fő stílusrendszer | **SCSS Modules** (`*.module.scss`) | A commitolt `*.module.css` + `.map` fordított kimenet — a `.scss` a forrás |
| Design tokenek | **`theme/theme.scss`** SCSS változókban | `$dark`, `$orange`, `$white`, `$navColor`, 3 radius token, 3 mixin (`centering`, `content`, `sidebar`) |
| Globális reset | `Main.module.scss:3-8` (`* { margin:0; box-sizing }`) | A resetet egy **komponens-modul** tartalmazza, nem globális stíluslap — törékeny |
| Egyéb globális | `index.css` (body font), `App.css` (`.App`, `.button` — **használaton kívül**) | `App.css` `.button` osztálya sehol nincs használva |
| Tailwind | `tailwindcss@3.3.5` **devDependency**, de **nincs config, nincs `@tailwind` direktíva, nincs egyetlen utility class sem** | Halott függőség — félrevezető (a CLAUDE.md is „unconfigured Tailwind"-ként említi) |
| Inline stílusok | Sok helyen, főleg `ArbitrageContent.tsx` és `Main.tsx` | Lásd 4.2 — a tokenrendszert megkerüli |

### Token-lefedettség

- **Színek**: részben tokenizált. `$orange`, `$dark`, `$white` léteznek, **de** a komponensekben rengeteg a hardkódolt hex/rgb: `rgb(37,35,35)`, `rgb(49,46,46)`, `#801414`, `#888`, `#ccc`, `rgb(255,102,0)`, `rgb(116,77,55)` stb. A `$navColor` (#801414) duplikálva van inline-ban is (`Main.tsx:30,35,40`).
- **Spacing**: **nincs spacing skála**. A paddingok/gapek szabadon szórnak: `6px`, `8px`, `12px`, `14px`, `15px`, `20px`, `25px`, `30px`, `42px` — nincs 4/8-as rács.
- **Tipográfia**: **nincs típusskála**. `font-size` ad-hoc: `16px`, `18px`, `20px`, `22px`, `26px`. A `$fontFamily: sans-serif` (theme) ütközik az `index.css` rendszer-font-stackjével.
- **Radius**: tokenizált (`$smallRadius/$midRadius/$largeRadius`), de a `MyButton` `$largeRadius` (20px) pill-formát ad sima gombnak — vizuálisan nehézkes.
- **Elevation/shadow**: ad-hoc, nem tokenizált (`Main` navbar fehér izzó árnyéka `rgba(#fbfafa, .2)` szokatlan).

---

## 4. UX gyengeségek

### 4.1 Vizuális hierarchia

- **Nincs alapútvonal/üres állapot**: `/` -re nincs redirect, így indításkor csak a navbar látszik üres tartalommal (`Main.tsx`). Nincs „nincs adat" / „kezdj a Refresh gombbal" üres állapot egyik oldalon sem.
- **Két párhuzamos tartalom-elrendezés** az Arbitrage oldalon: a normál nézet a `content` mixinnel (`top:60px; left:300px`), a „bet type" lista nézet viszont **hardkódolt** `marginLeft: 350; marginTop: 80` inline értékekkel (`ArbitrageContent.tsx:35`). A két nézet nem illeszkedik egymáshoz → ugráló layout váltáskor.
- **Sidebar/tartalom átfedés kockázata**: a `content` mixin `left: 300px` + `width: 100%`, a tartalom-container ezt `width: calc(100% - 300px)`-szel korrigálja (`!important`-tal, `ArbitrageContent.module.scss:28`). A `width:100%` + `left:300px` kombináció miatt a layout `!important` hackekre szorul — törékeny.
- **A „Fetch number" számláló** a navbarban (`Main.tsx:44`) fejlesztői debug-adat, ami productionben is látszik — nem felhasználói információ.
- **Táblázat-fejléc trükk**: az Arbitrage `RowItem` az `index === 0` esetben rendereli a `<thead>`-et (`RowItem.tsx:49`) — azaz a fejléc az adatok első elemét „elhasználja", a header logika az adatba van keverve. Sticky fejléc `position: sticky` van beállítva, de a `<table>`-nek nincs rögzített magassága/scroll-konténere, így a sticky gyakorlatilag nem ragad.

### 4.2 Konzisztencia

- **Nyelvi keveredés a UI-ban**: a navigáció és az Odds/Fixture oldalak magyarul („Győzelem", „Döntetlen", „Összes statisztika"), az Arbitrage oldal viszont **angolul** („Refresh Arbitrages", „Reset Filters", „Bet types", „Good Arbitrage"). Ugyanaz a felhasználó két nyelvet lát.
- **Inline stílusok kontra SCSS Modules**: az `ArbitrageContent.tsx` bet-type nézete **teljesen inline `style={{}}`-ból** épül (flex, marginok, színek — pl. kijelölés `backgroundColor: '#ff9e00'` a `$orange` helyett, `RowItem`/`Modal` viszont SCSS-ből). Két, egymással versengő styling-stratégia él egy oldalon belül.
- **Két `RowItem`** (lásd 2.) — eltérő DOM-struktúra (Odds: lapos `<tr>`; Arbitrage: header-az-adatban). Nincs közös sor-/cella-primitív.
- **Gombszövegek pongyolák / debug**: „Teszt log" gomb a Fixture sidebarban (`FixtureSidebar.tsx:23`) `console.log`-ot hív — debug funkció a felhasználói felületen.
- **Checkboxok ≠ valódi checkboxok**: az Arbitrage filtereknél a `<label onClick>` kezeli a state-et, a `<input type="checkbox" checked>` `onChange` **nélkül** van (`ArbitrageSidebar.tsx:41,61,82,100,120`). React kontrollált-input warning, és a checkbox vizuálisan néha kontrollként, néha radio-ként viselkedik (a „list view" / „parameters" valójában egyszeres választás, mégis checkbox).
- **Kétféle „X" bezáró gomb** szöveges „X"-ként (`Modal.tsx:21`, `FixtureInformationModal.tsx:34`) — nem ikon, nem `<button>`, nincs aria-label.
- **`key={uuidv4()}` listákban** (`OddsContent.tsx:39`, `ArbitrageContent.tsx:131`, `RowItem.tsx:59,77`): minden renderben új kulcs → React nem tudja a sorokat reusolni, teljesen újrarendereli a táblát (perf + fókuszvesztés). Anti-pattern.

### 4.3 Spacing és elrendezés

- **Nincs spacing-skála** (lásd 3.) — a gapek/paddingok kézzel hangoltak, ezért a kártyák/listák ritmusa egyenetlen.
- **`overflow-y: scroll` mindkét sidebaron** (`ArbitrageSidebar.module.scss:16`, `OddsSidebar.module.scss:15`) — fix scrollbar akkor is, ha nincs túlcsordulás → állandó csík + tartalomugrás.
- **Fix `height: 100vh` + `position: fixed` sidebar** a `top:60px` navbar alatt: a sidebar alja a viewport alá lóg (60px-szel), az utolsó gombokhoz `padding-bottom: 100px` a workaround (`ArbitrageSidebar.module.scss:16`). Magasság-számítás `calc(100vh - 60px)` lenne a helyes.
- **`CustomStat` kártyák fix `height: 60px`** (`CustomStat.module.scss:7`) — hosszú feliratok (pl. „Csapatok száma minimum 1 döntetlen") kilóghatnak/levágódhatnak, mert nincs `min-height` és a szöveg `centering`-gel középre van zárva sortörés-tartalék nélkül.
- **Modálok**: `Modal`/`FixtureInformationModal` `position: fixed; translate(-50%,-50%)`, de **nincs háttér-overlay/backdrop** (a LoadingScreennel ellentétben) → a mögöttes tartalom kattintható marad, nincs vizuális fókusz a modálra.

### 4.4 Akadálymentesség (a11y)

- **Nincs egyetlen `aria-*` attribútum sem** a teljes UI-ban (grep: 0 találat). Se `aria-label`, se `aria-expanded`, se `role`.
- **Kattintható `<div>`-ek gomb helyett**: dropdownok (`ArbitrageSidebar.tsx:32`), modál bezárás (`Modal.tsx:20`), sor-/cella-kattintás (`RowItem.tsx:76`), bet-type lista sorok (`ArbitrageContent.tsx:56`). Nem fókuszálhatók, nem kezelik az Enter/Space-t, képernyőolvasó nem jelzi interaktívnak.
- **`MyButton`-nek nincs `type="button"`** → form-kontextusban submit lenne; nincs `disabled`/`aria-busy` állapot a futó hosszú fetch alatt.
- **Fókuszkezelés a modálokban**: nincs focus-trap, nincs `Esc`-re zárás, megnyitáskor a fókusz nem ugrik a modálra, záráskor nem tér vissza. Billentyűzettel a modál gyakorlatilag használhatatlan.
- **Színkontraszt**: az `$orange` (#ff9e00) háttéren a `$dark` szöveg (arbitrage találat kiemelés) rendben, **de** a `$orange` aktív navigáció nincs (a nav aktív állapot a sötét #801414). A táblázat `#888` keretek és a `rgb(49,46,46)` háttéren `rgb(233,233,233)` szöveg jó, viszont a `MyButton:hover` `opacity: 0.9` finomságú jelzés gyenge. Érdemes WCAG AA-ra ellenőrizni (Playwright/axe).
- **Nincs `<label>`↔`<input>` asszociáció `htmlFor`-ral**; a `<label onClick>` minta nem helyettesíti a natív kötést.
- **Táblázat-szemantika**: a sticky fejléc az adatsorba van ágyazva (`RowItem` index 0), így a `<thead>` nem mindig a táblázat tetején, a screen reader sorrendje sérülhet. Az OddsContent fejléce viszont rendben külön `<thead>`-ben van.
- **Loading állapot nem hirdetett**: a `LoadingScreen` és a „Loading..." (`ArbitrageContent.tsx:29`) nincs `role="status"`/`aria-live`, képernyőolvasó nem jelzi.
- **`lang` attribútum**: ellenőrizendő a `public/index.html`-ben — vegyes magyar/angol tartalomnál fontos.

### 4.5 Reszponzivitás

- **Nincs egyetlen media query sem** a teljes stíluskódbázisban (grep: 0 `@media`). A layout fixen `300px` sidebar + `60px` navbar köré épül, abszolút pozícionálással → mobilon/keskeny nézeten a sidebar a tartalomra úszik, vízszintes görgetés.
- **Fix szélességek**: sidebar `300px`, `MyButton` `250px`, `LoadingScreen` `550×400px`, tartalom `calc(100% - 300px)` — egyik sem zsugorodik.
- A navbar `Fetch number` elem `marginLeft: auto` inline (`Main.tsx:44`) — keskeny nézeten kitör.

### 4.6 Visszajelzés és állapotok

- **Globális blokkoló loader**: a `MainStore.isLoading` egy teljes képernyős overlay-t mutat (`Main.tsx:25`). Az API throttling miatt (~61s szünetek 10 hívásonként, lásd CLAUDE.md) ez **percekig** állhat — nincs progress %, csak `loadingText`. A hosszú arbitrage-futás alatt az egész UI fagyottnak tűnik.
- **Nincs hibaállapot UI**: ha egy fetch elbukik (lejárt API kulcs — gyakori), nincs error toast/banner. A felhasználó nem tud különbséget tenni „üres eredmény" és „hiba" között.
- **`console.log` a render-ben**: `FixtureInformationModal.tsx:17` minden renderkor logol — fejlesztői maradvány.

---

## 5. Prioritált megállapítások

| # | Súly | Terület | Megállapítás | Hol |
|---|---|---|---|---|
| 1 | 🔴 magas | a11y | Nincs semmilyen `aria-*`, a kattintható elemek `<div>`-ek; modálok nem billentyűzhetők (nincs focus-trap/Esc) | egész UI |
| 2 | 🔴 magas | konzisztencia | `key={uuidv4()}` minden listában → teljes újrarenderelés, perf + fókuszvesztés | `RowItem.tsx:59,77`, `*Content.tsx` |
| 3 | 🔴 magas | konzisztencia | Kontrollált `<input checkbox>` `onChange` nélkül, state a `<label onClick>`-en | `ArbitrageSidebar.tsx` |
| 4 | 🟠 közepes | hierarchia | Nincs `/` redirect / üres állapot; induláskor üres képernyő | `Main.tsx` |
| 5 | 🟠 közepes | konzisztencia | Magyar/angol nyelvkeveredés a felületen | Odds/Fixture vs Arbitrage |
| 6 | 🟠 közepes | konzisztencia | Inline `style={{}}` vs SCSS Modules vs hardkódolt színek párhuzamosan | `ArbitrageContent.tsx`, `Main.tsx` |
| 7 | 🟠 közepes | spacing | Modálnak nincs backdrop overlay; mögöttes UI kattintható | `Modal`, `FixtureInformationModal` |
| 8 | 🟠 közepes | spacing | Sidebar `100vh` a `60px` navbar alatt + `overflow-y:scroll` mindig | `*Sidebar.module.scss` |
| 9 | 🟡 alacsony | tokenek | Halott Tailwind függőség (config/direktíva/usage nélkül) | `package.json` |
| 10 | 🟡 alacsony | tokenek | Nincs spacing-/típusskála; hardkódolt hexek a tokenek mellett | `theme.scss` + komponensek |
| 11 | 🟡 alacsony | reszponzivitás | 0 media query, fix px layout | egész UI |
| 12 | 🟡 alacsony | egyéb | Debug a UI-ban: „Teszt log" gomb, „Fetch number", `console.log` renderben | `FixtureSidebar.tsx:23`, `Main.tsx:44`, `FixtureInformationModal.tsx:17` |
| 13 | 🟡 alacsony | konzisztencia | Két külön `RowItem`; nincs közös sor/cella primitív; `App.css .button` halott | `pages/*/RowItem`, `App.css` |

---

## 6. Mit csinál jól

- **Egységes táblázat-stílus** (sötét fej, `$orange` kiemelés a profitábilis arbitrage-cellán) — világos, célorientált adathangsúly (`RowItem.module.scss:35`).
- **Tokenizált radius + színek alapjai + mixinek** léteznek (`theme.scss`) — van mire építeni egy rendszert.
- **Loading spinner** (`lds-ring`) szép, működő CSS-animáció — bár háromszor duplikált (`LoadingScreen`, `ArbitrageContent.module.scss`, FixtureInformationModal scss).
- **Oldal-modul minta** (`components/`, `models/`, `services/`, `stores/` oldalanként) — tiszta szerkezet, könnyen bővíthető.
- **SCSS Modules scope-olás** — nincs globális class-szivárgás (a `Main.module.scss` `*` reset kivételével).

---

## 7. Ajánlott következő lépés (külön jóváhagyással)

1. **Tényellenőrzés futó appon**: Playwright + `axe-core` futtatás a három útvonalon → tényleges kontraszt-/a11y-jelentés és reszponzív screenshotok (keskeny/széles).
2. Döntés a **stílusstratégiáról**: vagy a Tailwindet aktiváljuk és onnan jönnek a tokenek, vagy kivesszük és az SCSS-token-rendszert bővítjük (spacing/típus skála). Jelenleg a kettő közti félút okozza a zajt.
3. A 🔴 magas tételek (a11y, `uuidv4` kulcsok, kontrollált checkboxok) gyors, kockázatmentes javítások — jó első kör, ha a felhasználó zöld utat ad.

> Emlékeztető: ez a dokumentum **nem** módosított semmilyen forrást. Bármely változtatás külön kérésre.
