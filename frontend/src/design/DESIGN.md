# Odds elemző – Design rendszer („Floodlight”) · v0.2

> **Kinek szól:** a Claude CLI-nek és fejlesztőnek, amikor a `football-app` frontendjét
> az új dizájn szerint alakítja. **Mi változott a v0.1-hez képest:** világos téma
> (`data-theme`), új szemantikus tokenek (`on.*`, `accent.text/on`, `status.*`, `tint.*`),
> átrendezett „Ma” és „Kiértékelés” oldal. **Viszony a PRD-hez:** a PRD mondja meg, *mit*
> mutatunk; ez a dokumentum, hogy *hogyan*. Ütközés esetén a PRD nyer.

Referencia (böngészőben megnyitható, sötét/világos váltóval): `reference/ma.html`,
`reference/kiertekeles.html`. Képernyőképek: `screens/`.

---

## 1. Gyors szabályok

1. **Nyers szín, px-térköz, betűméret nem kerül komponensbe.** CSS-ben `var(--…)`,
   TS-ben `v('color.bg.surface')` (`tokens.ts`). Chart-könyvtárnak, ahol CSS-változó nem
   megy: `themes[theme].color…` (feloldott hex, témánként).
2. **Forrás:** `tokens.json` (sötét alap) + `tokens.light.json` (világos felülírások).
   `tokens.css` és `tokens.ts` generált: `node design/tokens/build-tokens.mjs`.
3. **Kiemelés fegyelme:** az accent (türkiz) **csak** érték/pozitív (+EV, +pp, CLV),
   a fő CTA („Tippmixre viszem”) és a „szelvényen” állapot. **Kiválasztás = semleges**
   (`on.bg`/`on.fg`): aktív menüpont, szegmens, tét, tipp-badge, „+ Szelvényre” gomb.
4. **Accent szövegként mindig `accent.text`**, kitöltésként `accent.default`, rajta
   `accent.on`. (Világosban a kettő különbözik, különben nem olvasható.)
5. **Minden kattintható elem valódi `<button>`/`<a>`, legalább 44×44 px.** Állapot
   `aria-pressed` / `aria-expanded` / `aria-current`; a CSS ezekre épül.
6. **Számformázás magyarul** (§7), közös `format.ts`-ből.
7. **Képletek a tiszta magban** (§8). A UI formáz, nem számol üzleti logikát.
8. **Tilos:** gradiens háttér, glow, üveghatás, emoji ikon, bal oldali színes csík.
9. UI-változás után screenshot **sötét és világos** témában, **1440 és 390 px** szélen;
   vízszintes görgetés nem lehet.

## 2. Elvek

| Elv | A gyakorlatban |
|---|---|
| **A döntés elöl, a bizonyíték lenyitva** | Kártyán: tipp, EV, legjobb odds, Tippmix-min., esély, 2–3 „Miért?” csip, forma. Lenyitva: teljes indoklás, tabella, H2H, utolsó 5, forrás. |
| **Az állapot kicsi, nem hangos** | Állandó állapot (mentett adat, régi odds) chip a cím alatt, magyarázat kattintásra. Nem nagy doboz a lista tetején. |
| **Üres hely = lehetőség** | Az üres szelvény-panel a motor kész szelvényeit kínálja. |
| **Ítélet előbb, adat utána** | A Kiértékelés egy mondattal kezd („A modell még nem veri a piacot.”), utána a PRD-célok táblája, csak aztán a részletek. |
| **Minden számnak viszonyítás** | Találati arány a várthoz, ROI a nullához és a konfidencia-sávhoz, Brier a piachoz. |
| **Kompakt oldalcím** | Kétsoros nagy cím csak a „Ma” oldalon. Máshol 32 px cím + meta-chipek. |

## 3. Tokenek és téma

### 3.1 Téma-mechanika
- `<html data-theme="dark|light">`. Az alap (attribútum nélkül) sötét; ha nincs kézi
  választás, a `prefers-color-scheme` dönt (ezt a `tokens.css` kezeli).
- **Preferencia:** `localStorage['oe-theme'] = 'dark' | 'light'`; hiánya = rendszer.
  A `THEME_STORAGE_KEY` a `tokens.ts`-ből jön.
- **Villanásmentes betöltés:** az `index.html` `<head>`-jében, a CSS előtt egy inline script
  feloldja a preferenciát és beállítja a `data-theme`-et (minta: `reference/ma.html` eleje).
- **Váltó:** a fejlécben (`.oe-theme-toggle`), sötétben nap ikon, világosban hold.
  Kattintás → `data-theme` csere + mentés. A Beállításokban opcionálisan
  „Téma: Rendszer / Sötét / Világos”.
- Chartoknál a színt a téma-váltásra újra kell olvasni (`themes[theme]`, vagy
  `getComputedStyle`), ne égesd be.

### 3.2 Kulcs-tokenek (teljes lista: `tokens.json`)

| Token | Sötét | Világos | Mire |
|---|---|---|---|
| `color.bg.canvas` | #0B1220 | #F5F7FA | oldal |
| `color.bg.surface` | #121B2E | #FFFFFF | kártya, panel |
| `color.bg.raised` | #17223A | #F2F5F9 | csempe, preset |
| `color.bg.selected` | #13283A | #EEF9F6 | szelvényen lévő kártya |
| `color.text.primary / secondary / muted` | #E8EDF7 / #C7D0E2 / #93A0B8 | #0F1A2B / #334155 / #5B6779 | szöveg |
| `color.on.bg / on.fg` | #E8EDF7 / #0B1220 | #0F1A2B / #FFFFFF | semleges kiválasztás |
| `color.accent.default / text / on` | #35E0C2 / #35E0C2 / #0B1220 | #14B8A0 / #0A7F6E / #0F1A2B | érték |
| `color.signal.negative / negative-text` | #FF8A65 | #E4572E / #C2410C | negatív |
| `color.signal.warning / warning-text` | #FFC56B | #F2B544 / #9A4A07 | figyelmeztetés |
| `color.status.ok-* / fail-*` | | | „✓ Teljesül / ✗ Nem teljesül”, delta-pill |
| `color.tint.*` | | | állapot-chip, ítélet-sáv, konfidencia-sáv háttér |
| `shadow.card` | none | 0 1px 2px … | kártyák |

Kontraszt (ellenőrizve): minden szöveg-pár ≥ 4,5:1 mindkét témában
(pl. világosban `accent.text` a fehéren 4,9, `muted` a `raised`-en 5,3).
`data.market` csak grafika.

## 4. Tipográfia

| Szerep | Token | Megjegyzés |
|---|---|---|
| Ma-oldal kétsoros cím | `font.size.h1` 38 (mobil 28), Sora 600 | 2. sor `text.muted` |
| Oldalcím máshol | `font.size.page` 32, Sora 600 | alatta `.oe-meta-chip`-ek |
| Szekciócím | `font.size.h3` 20, Sora 600 | mellette `.oe-section-sub` |
| Párosítás a kártyán | `font.size.match` 22, Manrope 800 | „Bochum – Augsburg” |
| EV a kártyán | `font.size.num-xl` 36, Sora 700, `accent.text` | jobb felső sarok |
| KPI-érték | `font.size.num-l` 32 | tónus: `data-tone` |
| Csempe-érték | `font.size.num-m` 22 | |
| Címke | `.oe-label` 12/700, nagybetű, 0,08em | MIÉRT?, TABELLA… |

## 5. Elrendezés
- Konténer max. 1280 px, gutter 28 (mobilon 18).
- **Ma:** `.oe-split` – fő hasáb (`flex: 999 1 600px`) + szelvény (`flex: 1 1 360px`,
  `position: sticky`, 1000 px alatt statikus, a lista alá kerül).
- **Kiértékelés:** egy hasáb, `.oe-stack` (28 px köz): oldalfej → ítélet → sikermutatók →
  KPI-k → pontosság → kalibráció.
- Széles táblák `.oe-table` dobozban vízszintesen görgethetők (`--min`), az oldal nem.

## 6. Komponensek (osztály → leírás)

A markup a `reference/*.html`-ben, a stílus a `components.css`-ben.

### Közös
| Osztály | Leírás |
|---|---|
| `.oe-header`, `.oe-brand`, `.oe-nav`, `.oe-nav__link[aria-current]` | fejléc; aktív menüpont semleges kitöltés |
| `.oe-status-pill[data-state="live|saved|stale|error"]` | „Mentett adat · 0/100 hívás”; a pötty színe az állapot |
| `.oe-theme-toggle` | sötét/világos váltó (két ikon, CSS mutatja a megfelelőt) |
| `.oe-page-head`, `.oe-page-title`, `.oe-meta-chip` | kompakt oldalfej |
| `.oe-hero`, `.oe-h1` | csak a Ma oldalon |
| `.oe-pill`, `.oe-pill--warning`, `.oe-linkbtn`, `.oe-datastate__detail` | adat-állapot sor + „Mit jelent?” lenyitó |
| `.oe-segmented(__btn[aria-pressed])`, `.oe-field`, `.oe-select` | szűrők |
| `.oe-btn` + `--primary` (accent) · `--neutral` (on) · `--cta` · `--icon` | gombok |
| `.oe-label`, `.oe-section-head`, `.oe-section-sub` | címkék |

### Ma – tippkártya `.oe-tip[data-selected]`
Sorrend felülről:
1. `.oe-tip__head`: balra meta (`liga · idő · bizonyosság`), `.oe-tip__title`,
   `.oe-tip__market` (piac + `.oe-badge` a kimenettel); jobbra `.oe-tip__ev`.
2. `.oe-decision` – három `.oe-tile`: **Legjobb odds** (+ iroda · időpont),
   **Tippmixen legalább** (+ „ennél rosszabbra ne”), **Esély · szerintünk / irodák**
   (`36% / 33%` + `.oe-pbar` `--p` kitöltés, `--m` piaci jel).
3. **Miért?** – `.oe-why__chips`: max. 3 tényező a kiválasztott kimenetre, |pp| szerint
   csökkenő sorrendben; negatív: `data-tone="negative"`. Más piacra ható tényező
   (pl. gólszegénység egy 1X2 tippnél) csak a lenyitott indoklásba kerül.
4. `.oe-teams` – helyezés + utolsó 5 (`.oe-chip--win/draw/loss`, legrégebbi balra).
5. `.oe-warning` – adatminőség (0..n sor).
6. `.oe-tip__actions` – `.oe-btn--add[aria-pressed]` („+ Szelvényre” → „✓ Szelvényen”)
   és `.oe-disclosure[aria-expanded]` („Indoklás, tabella, egymás ellen” ↔ „Részletek elrejtése”).
7. `.oe-tip__details` – `.oe-reasons` (teljes indoklás), `.oe-details` rács: tabella
   (`.oe-strip` + `.oe-legend` + `.oe-standing`), egymás ellen (`.oe-row--h2h`, összegzés
   a hazai szemszögéből), két „utolsó 5” lista (`.oe-row`, legutóbbi felül), végül
   `.oe-tip__source` (iroda, időpont, tét, modellverzió).

Alapértelmezés: az első kártya nyitva, a többi csukva; egyszerre egy nyitott kártya ajánlott.

### Ma – szelvény `.oe-slip`
- **Üres állapot:** `.oe-slip__hint` + „KÉSZ SZELVÉNYEK” + `.oe-preset` gombok
  (név, `Ajánlott` címke `.oe-tag--accent`, lábak `.oe-preset__legs`, odds/esély/EV,
  `.oe-risk-dot[data-level]` „kb. minden N-edik ilyen szelvény nyer”).
  Kattintás → a szelvény feltöltődik a preset lábaival, utána szabadon szerkeszthető.
- **Kitöltött állapot:** lábak (`.oe-slip__leg`, ✕ ikon-gomb), két csempe (Eredő odds +
  „Tippmixen min.”, Várható érték), Találati esély + `.oe-risk__fill[data-level]`,
  tét (`.oe-stake`, semleges kiválasztás), Lehetséges nyeremény, **Tippmixre viszem**
  (`--primary --cta`), „Szelvény ürítése” (`.oe-linkbtn--muted`).

### Kiértékelés
| Osztály | Leírás |
|---|---|
| `.oe-verdict[data-tone="negative|positive"]` | ítélet-sáv: ikon, egy mondatos cím, 1–2 mondat indoklás. A szöveg a metrikákból áll elő (§8.3). |
| `.oe-table` (`--cols`, `--min`) + `__row`, `__row--head`, `__row--best`, `__sub`, `__num` | kártyás táblázat |
| `.oe-goal-pill--ok / --fail` | „✓ Teljesül” / „✗ Nem teljesül” |
| `.oe-delta[data-tone="bad|good"]` | eltérés-pill (pl. log-loss vs. záró) |
| `.oe-kpis`, `.oe-kpi`, `__value[data-tone]`, `__foot` | KPI-kártyák |
| `.oe-compare` (`--v`, `--ref`) | érték-sáv referencia-jellel (találati arány vs. várt) |
| `.oe-ci` (`--from`, `--to`, `--at`, `--zero`) | konfidencia-intervallum a nullához (ROI) |
| `.oe-calib`, `.oe-chart` (`__y`, `__plot`, `__grid`, `__svg`, `__diag`, `__line`, `__dot` `--x --y --s`, `__x`) | kalibrációs grafikon; pontméret `8 + √n / 4,5` px; `n < 30` → `data-low-n` |
| `.oe-calib-row(--head)`, `.oe-dev[data-flag|data-low-n]` | kalibrációs táblázat; kiemelés, ha \|eltérés\| ≥ 5 pp és n ≥ 30 |

## 7. Szám- és szövegformázás

| Mi | Szabály | Példa |
|---|---|---|
| Odds | 2 tizedes, vessző | `3,00` |
| Valószínűség | egész % | `36%` |
| Különbség | egész pp, előjellel, valódi mínusz (−) | `+12 pp`, `−4 pp` |
| EV, ROI, CLV | %, előjellel; CLV 1 tizedes | `+7%`, `−21%`, `+1,1%` |
| Pénz | egész Ft, ezres nem törő szóköz – négyjegyűnél is | `1 000 Ft`, `3 096 Ft` |
| Darabszám | ezres szóköz | `2 553`, `3 504` |
| Brier, log-loss | 3 tizedes, vessző | `0,595` |
| Időpont | `ma 15:30`, `V 17:30` | |
| Párosítás / eredmény | nagykötőjel | `Bochum – Augsburg`, `2–0` |

> Megvalósítás: `new Intl.NumberFormat('hu-HU', { useGrouping: 'always' })`. Alapból a hu-HU
> a négyjegyű számokat nem tagolja (`1000`), a tervekben viszont `1 000` szerepel.

## 8. Képletek és szabályok (a tiszta magban)

### 8.1 Tipp és szelvény
```
EV           = p_modell × odds − 1
min. odds    = (1 / p_modell) × (1 + EV-küszöb)
kötés odds   = Π odds_i        kötés esély = Π p_i (független meccsek)
kötés EV     = Π p_i × Π odds_i − 1        kötés min. = Π min_i
nyeremény    = tét × eredő odds
kockázat     = esély ≥ 35% → low · 15–35% → medium · < 15% → high
„minden N-edik” = N = round(1 / esély), sorszámnévvel (harmadik, kilencedik…)
```
Ugyanarról a meccsről két láb nem kerülhet egy szelvényre.

### 8.2 Kész szelvények (presetek)
- **Szingli:** a legnagyobb EV-jű tipp; „Ajánlott”, ha a kockázata low/medium.
- **Dupla:** a két legjobb tipp (EV szerint), ha különböző meccsek.
- Max. 3 preset; ha csak 1 tipp van, csak a szingli látszik.
- A presetet a mag számolja, a UI csak megjeleníti.

### 8.3 Kiértékelés ítélet-sáv
- `negative`, ha a ROI 95%-os felső határa < 0 **vagy** a modell Brierje rosszabb a
  záró piacénál. Cím: „A modell még nem veri a piacot.”
- `positive`, ha minden PRD-cél teljesül. Cím: „A modell jobb a piacnál.”
- Egyébként semleges (`tint`-mentes kártya), cím: „Vegyes kép.”
- A szöveg 1–2 mondat a legrosszabb és a legjobb mutatóról, számmal.

### 8.4 Sikermutatók (PRD 9. fejezet)
| Mutató | Cél |
|---|---|
| Brier (1X2) | modell ≤ piac |
| Log-loss a záró piachoz | modell ≤ piac |
| Kalibráció | átlagos eltérés < 5 pp |
| CLV | > 0 |
| ROI flat téttel | > 0, 300+ tipp után (előtte „tájékoztató” pill) |

## 9. Mikrocopy

| Helyett | Ezt írd |
|---|---|
| Modell / Piac | Szerintünk / Irodák (szerint) |
| Value | érték, „+7 pp érték a javunkra” |
| Minimum odds | Tippmixen legalább (kártya), Tippmixen min. (szelvény) |
| Add to slip | + Szelvényre / ✓ Szelvényen |
| Kész szelvények | (a szelvény üres állapotában) |
| Garantált hozam (Arbitrázs) | Irodák közötti árkülönbségek |

Hangnem: tegeződő, rövid, tényszerű. Nincs „biztos tipp”, „garantált”, felkiáltójel.

## 10. Akadálymentesség
- `:focus-visible` gyűrű (2 px accent), sosem kikapcsolva.
- Sávok és grafikonok: `role="img"` + `aria-label` szöveges összefoglalóval.
- Forma-chip sor: `<ol aria-label="Bochum utolsó 5: V Gy V V V">`.
- Lenyitó: `aria-expanded` + `aria-controls`, a tartalom `hidden`.
- `prefers-reduced-motion` tiszteletben tartva.

---
*v0.2 · 2026-11-13 · forrás: design-vászon „A mostani app átrendezve – Ma és Kiértékelés”.
A tervekben és a referenciában minden szám minta vagy a 2025. áprilisi mentett adat.*
