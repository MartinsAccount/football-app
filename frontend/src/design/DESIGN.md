# Odds elemző – Design rendszer („Floodlight”)

> **Kinek szól:** a Claude CLI-nek (és fejlesztőnek), amikor a `football-app` frontendjét
> az új dizájn szerint építi. **Forrás:** a „D1 · Szelvényépítő”, „D2 · Szelvényajánlatok”
> és „D3 · Mobil” tervek a design-vásznon. **Viszony a PRD-hez:** a PRD mondja meg, *mit*
> mutatunk; ez a dokumentum azt, hogy *hogyan*. Ha a kettő ütközik, a PRD nyer, és ezt a
> fájlt kell igazítani.

Tartalom: [1. Gyors szabályok](#1-gyors-szabályok-claude-cli) · [2. Elvek](#2-elvek) ·
[3. Tokenek](#3-tokenek) · [4. Tipográfia](#4-tipográfia) · [5. Szín szemantika](#5-szín-szemantika) ·
[6. Layout](#6-layout-és-reszponzivitás) · [7. Komponensek](#7-komponensek) ·
[8. Számformázás](#8-szám--és-szövegformázás) · [9. Képletek](#9-domain-képletek-a-ui-ban) ·
[10. Mikrocopy](#10-mikrocopy-szótár) · [11. Akadálymentesség](#11-akadálymentesség) ·
[12. Tilos / kötelező](#12-tilos--kötelező) · [13. React/MobX vázlat](#13-reactmobx-komponensfa-javaslat)

---

## 1. Gyors szabályok (Claude CLI)

1. **Nyers színt, pixel-térközt, betűméretet nem írsz komponensbe.** Mindig token:
   CSS-ben `var(--color-…)`, TS-ben `v('color.bg.surface')` a `tokens.ts`-ből.
2. **A `tokens.json` az egyetlen forrás.** A `tokens.css` és `tokens.ts` generált fájl:
   `node frontend/src/design/tokens/build-tokens.mjs`. Kézzel nem szerkeszted őket.
3. **Egy akcentszín van** (`--color-accent-default`, türkiz). Ez jelenti: modell, pozitív
   érték, kiválasztás, fő CTA. Nem dekoráció.
4. **Számok:** magyar formátum (tizedesvessző, ezres szóköz), `tabular-nums`. Lásd §8.
5. **Képletek** (EV, min. odds, kötés) a tiszta magban vannak, nem a komponensben. A UI
   csak formáz. Lásd §9.
6. **Minden kattintható elem valódi `<button>` / `<a>`**, legalább 44×44 px. Állapot
   `aria-pressed` / `aria-expanded` / `aria-current` attribútummal, a CSS ezekre épül.
7. **Nincs:** gradiens háttér, árnyék-halmozás, emoji ikonként, bal oldali színes csík a
   kártyán, „glassmorphism”. Lapos felületek + 1 px keret.
8. UI-változás után screenshot a futó appról **asztali (1440) és mobil (390) szélességen**
   (PRD 12. fejezet), és ellenőrizd, hogy nincs vízszintes görgetés.
9. A referencia-megvalósítás: `components/components.html` + `components/components.css`.
   Ha egy komponens kinézete kétséges, ehhez igazodj.

## 2. Elvek

| Elv | Mit jelent a gyakorlatban |
|---|---|
| **Reggeli brief, nem terminál** | A kezdőoldal egy nyugodt összefoglaló: mi a mai döntés, mennyi az érték, mit vigyek Tippmixre. Sűrűség helyett hierarchia. |
| **A döntés elöl, a bizonyíték lenyitva** | A kártyán mindig látszik: tipp, esély (szerintünk vs. irodák), odds, Tippmix-min., EV, forma-chipek, helyezés. A H2H, utolsó 5 részletesen, tabella **lenyitható**. |
| **Átlátható érték** | Minden szám mellett ott a forrása vagy kora („Bet365 · 09:12”, „A sérültlista 20 órás”). |
| **A szelvény az eredmény** | Minden képernyő a Tippmix-szelvény felé vezet: „+ Szelvényre” → szelvény-panel → „Tippmixre viszem” → Tippmix-odds bevitele → „Megtettem”. |
| **Őszinte kockázat** | A kötés esélye mindig látszik, színkódolt kockázattal, és mellette a szingli-összevetés. |
| **0 külső hívás megnyitáskor** | A UI csak DB-ből olvas (PRD 7.1). Betöltéskor skeleton, nem spinner az egész oldalon. |

## 3. Tokenek

Fájlok: `tokens/tokens.json` (DTCG formátum), generálva → `tokens/tokens.css`
(`:root` változók) és `tokens/tokens.ts` (`tokens` nyers értékek, `cssVar` / `v()` hivatkozások).

- CSS-változó neve = token útvonala kötőjellel: `color.bg.surface` → `--color-bg-surface`.
- Hivatkozó tokenek (`{color.accent.default}`) a CSS-ben `var(...)`-ként maradnak, így a
  téma-váltás mindenhol érvényesül.
- **Téma-akcent:** `<html data-accent="blue">` vagy `"violet"`. Alapértelmezés: türkiz.
  (Az `alt-amber` ütközik a warninggal, csak akkor használd, ha a warningot is átszínezed.)
- **Canvas/SVG/chart-könyvtár** (ahol CSS-változó nem működik): `tokens.color.accent.default`
  (feloldott hex).

Kategóriák: `color.*` (bg, border, text, accent, signal, data, result, zone, risk),
`font.*`, `space.0–28` (2 px-es lépcső eleje, utána 4 px), `radius.*`, `size.*`, `motion.*`, `focus.*`.

## 4. Tipográfia

| Szerep | Család | Méret / súly | Megjegyzés |
|---|---|---|---|
| Oldalcím | Sora | `h1` 42 / 600, `-0.03em`, mobil 28 | Második sor `text.muted` színnel: „Rakd össze… / 6 értékes tipp…” |
| Szekciócím (Ma, Holnap, Szelvényem) | Sora | `h3` 20 / 600 | mellette `small` muted számláló |
| Párosítás a kártyán | Manrope | `lead` 17 / 700 | „Bologna – Lazio” (nagykötőjel, szóközökkel) |
| Nagy szám (EV, eredő odds) | Sora | `num-l` 28 / 700 | `tabular-nums` |
| Törzs | Manrope | `body` 15 / 400–600 | sormagasság 1,5 |
| Címke (TABELLA, EGYMÁS ELLEN) | Manrope | `caption` 12 / 700, nagybetű, `0.08em` | `.oe-label` |
| Tile-címke (odds, Tippmix min.) | Manrope | `micro` 11 / 400 | muted |

Betöltés: Google Fonts, `Sora:400;600;700`, `Manrope:400;500;600;700;800`, `display=swap`.

## 5. Szín szemantika

| Jelentés | Token | Hol |
|---|---|---|
| Modell / „Szerintünk” | `data.model` (= accent) | valószínűség-sáv, EV, „+X pp érték” |
| Piac / „Irodák szerint” | `data.market` | **csak sáv**, szövege `text.muted` |
| Pozitív / nyert / Gy | `result.win` (= accent) | chip, profit |
| Döntetlen / D | `result.draw` | chip |
| Negatív / vereség / V / min. alatti odds | `signal.negative` | chip, negatív tényező, hibás mező |
| Adatminőség (régi adat, kevés H2H) | `signal.warning` | `⚠` sor a kártyán |
| Kockázat | `risk.low / medium / high` | szelvény találati-esély sávja (≥35% / 15–35% / <15%) |
| Tabella-zóna | `zone.champions / europe / mid / relegation` | tabella-sáv |
| Hazai / vendég a tabellán | `zone.home` (világos) / `zone.away` (accent) | tabella-sáv + jelmagyarázat |

Szabály: a színnel jelzett állapot mindig **betűvel vagy szöveggel is** megjelenik
(Gy/D/V, „✓ megéri”, „✗ min. alatt”), sosem csak színnel.

Kontraszt (ellenőrizve, `bg.surface`-en): primary 14,6 · secondary 11,1 · muted 6,5 ·
accent 10,3 · negative 7,4 · warning 11,0. `data.market` 4,1 → szövegre nem használható.

## 6. Layout és reszponzivitás

- Konténer: max. `1280px`, oldalsó gutter `28px` (mobilon `18px`).
- **Fő + oldalsáv** (`.oe-split`): flex-wrap; `main` `flex: 999 1 600px`, `aside`
  `flex: 1 1 360px`. Keskeny képernyőn az oldalsáv a lista alá kerül, töréspont nélkül.
- **Kártyarács** (`.oe-card-grid`): `repeat(auto-fill, minmax(min(100%, 320px), 1fr))`, gap 12.
  A kinyitott kártya `grid-column: 1 / -1` (teljes sor).
- **Mobil (< 640 px):** a szelvény-panel helyett alul lebegő **szelvény-sáv**
  (`.oe-slipbar`: „Szelvény · 2 tipp, dupla / odds 3,10 · esély 39% / Megnyitás”), ami
  **alsó lapot** nyit (`.oe-sheet`). Nincs külön mobil-oldal, ugyanaz a komponens.
- Vízszintes görgetés sehol. Hosszú csapatnév: `ellipsis`.

## 7. Komponensek

Mindegyiknél: **cél → anatómia → állapotok → osztályok → adat**. A teljes markup a
`components/components.html`-ben.

### 7.1 AppHeader
- Logó + „Odds elemző”, pill-navigáció (`.oe-nav`, aktív: `aria-current="page"`),
  jobbra adatfrissesség (`.oe-status`, `data-state="fresh|stale|error"`) + napi hívásszám.
- Navigáció: **Ma · Szelvény · Kiértékelés · Odds** (+ Arbitrázs, Beállítások ikonként vagy
  overflow-ban; PRD 5.8).

### 7.2 PageIntro
- Dátum (muted, small) → kétsoros `h1` (második sor muted).
- Jobbra opcionális **ModeSwitch** (`.oe-segmented`): „Motor javaslata / a legerősebb
  kombináció” ↔ „Én rakom össze / szabad választás”.

### 7.3 EngineBanner
- `.oe-banner`, csak „Motor javaslata” módban. Félkövér cím + egy mondat indoklás.

### 7.4 TipCard – a fő egység
Anatómia felülről lefelé:
1. **Meta sor:** `Liga · ma 15:00` balra, `bizonyosság: magas` jobbra (caption, muted).
2. **Cím:** párosítás (`lead`) + piac Tippmix-nyelven: „Gólok száma 2,5 · Alatt”,
   „Végeredmény · 1”.
3. **TeamForm sor** (`.oe-teams`): két oszlop, mindkettőben `7. Bologna` + 5 **FormChip**,
   *legrégebbi balra, legutóbbi jobbra*. Chip `title`: „Gy vs Lecce 2–0”.
4. **ProbabilityBars** (`.oe-prob`): „Szerintünk” (accent) és „Irodák szerint” (market),
   jobbra %, alatta `+7 pp érték a javunkra` (accent, bold).
5. **Actions sor:** `odds` · `Tippmix min.` · `EV` (accent, Sora) + jobbra a
   **SlipToggle** (`.oe-btn--toggle`, `aria-pressed`): „+ Szelvényre” ↔ „✓ Szelvényen”.
6. **Figyelmeztetések** (0..n): `⚠ A sérültlista 20 órás` (`.oe-warning`).
7. **Disclosure** (`.oe-disclosure`, `aria-expanded`, `aria-controls`):
   csukva „Forma, egymás elleni, tabella”, nyitva „Részletek elrejtése”.
8. **MatchDetails** (csak nyitva) – lásd 7.5.

Állapotok: `data-selected="true"` (szelvényen: `bg.selected` + accent keret),
`data-expanded="true"` (teljes sor). **Egyszerre egy kártya lehet nyitva.**

Adat (PRD 6. fejezet szerint): `fixture`, `league`, `kickoff`, `market`, `outcome`,
`tippmixLabel`, `pModel`, `pMarket`, `bestOdds`, `bookmaker`, `oddsAt`, `minOdds`, `ev`,
`confidence`, `warnings[]`, `home{rank, points, gd, stake, last5[]}`, `away{…}`, `h2h[]`,
`modelVersion`.

### 7.5 MatchDetails (lenyitott rész)
`.oe-details` rács (`auto-fit, minmax(300px,1fr)`), négy blokk, mindegyik `.oe-label` címmel:

| Blokk | Tartalom |
|---|---|
| **Tabella · {liga}** | **LeagueStrip**: 1 cella / hely (20 vagy 18), zónaszínek, hazai cella `zone.home`, vendég `zone.away`. Jelmagyarázat: „1.–20. hely · BL · európai kupa · kiesés”. Alatta csapatonként: `7. Bologna · 18 pont · gólkül. +4` + muted „Tét: európai kupahelyért”. |
| **Egymás ellen · utolsó N** (max 5) | `.oe-row--h2h`: dátum (`2025.04`) · párosítás · eredmény · chip **a mostani hazai csapat szemszögéből**. Összegzés: „Bologna szemszögéből: 1 Gy · 3 D · 1 V · átl. 1,8 gól · 4/5 meccs 2,5 alatt”. Ha N < 4: warning „Kevés egymás elleni meccs, a H2H súlya kicsi.” |
| **{hazai} · utolsó 5** | `.oe-row`: chip · `vs`/`@` + ellenfél · eredmény, **legutóbbi felül**. Összegzés: „3 Gy · 1 D · 1 V · átl. 2,4 gól/meccs”. |
| **{vendég} · utolsó 5** | ugyanaz |

Alul jelmagyarázat (`.oe-details__legend`): „Gy = győzelem · D = döntetlen · V = vereség ·
„vs” = otthon, „@” = idegenben”. Későbbi bővítés: **Hiányzók** blokk (sérültek/eltiltottak).

### 7.6 SlipPanel (szelvény)
Asztalon jobb oldalsáv, mobilon alsó lap. Felülről:
1. Fej: „Szelvényem” + típus („Szingli”, „Dupla kötés”, „Hármas kötés”…) · `n tipp`.
2. **Üres állapot:** „Még üres a szelvény” + „Adj hozzá tippeket a listából, vagy kérd a motor javaslatát.”
3. Lábak (`.oe-slip__leg`): párosítás, Tippmix-piac · időpont, odds + „min. X”, ✕ ikon-gomb
   (`aria-label="Tipp levétele a szelvényről"`).
4. **Totals** (két `.oe-tile`): „Eredő odds” + „Tippmixen min. X” · „Várható érték” + „modell szerint”.
5. **Találati esély** + kockázat-sáv (`.oe-risk__fill[data-level]`) + egymondatos magyarázat.
6. **StakeSelector** (`.oe-stake`): 500 / 1 000 / 2 000 / 5 000 Ft (beállításból jön az egység).
7. „Lehetséges nyeremény” (Sora, `num-m`).
8. Szingli-összevetés (`.oe-slip__note`).
9. CTA: **„Tippmixre viszem”** (`.oe-btn--primary.oe-btn--cta`).

### 7.7 TippmixTransfer (Tippmixre vitel)
A CTA után (asztalon panel, mobilon az alsó lapban). Lábanként: sorszám, párosítás,
Tippmix-piac, „min. odds”, **TippmixOddsField** (`.oe-field` + `.oe-input`,
`inputmode="decimal"`, vesszőt és pontot is elfogad) és állapot:
`✓ megéri` (`data-valid`), `✗ min. alatt` (`aria-invalid`), `odds kell` (üres).
Ha egy láb min. alatt van: piros doboz cserejavaslattal. Az összesítő a **beírt
Tippmix-oddsokkal** számol újra. Gomb: „Megtettem – szelvény mentése” (`.oe-btn--light`).

### 7.8 SlipPresets (D2 – motor kész szelvényei)
Opcionális gyorsválasztó a ModeSwitch „Motor javaslata” ágán: kártyánként típus-badge
(Szingli csomag / Dupla kötés / Hármas kötés / Rendszer 2/3), név, egymondatos indoklás,
lábak, eredő odds, esély, EV, tét → nyeremény, 3 fokú kockázat-jelző, „Ajánlott” badge.
Kiválasztás után a SlipPanel ezzel töltődik fel, és szabadon szerkeszthető.

### 7.9 Mobil: SlipBar + BottomSheet
- `.oe-slipbar`: alul lebegő accent sáv, mindig látszik, ha ≥ 1 tipp van a szelvényen.
- `.oe-sheet`: alsó lap fogantyúval (`.oe-sheet__handle`), mögötte `.oe-sheet-backdrop`.
  Bezárás: ✕ gomb, háttérre kattintás, Esc. Fókusz a lapba kerül, bezáráskor vissza.

## 8. Szám- és szövegformázás

| Mi | Szabály | Példa |
|---|---|---|
| Odds | 2 tizedes, **vessző** | `1,80` · `3,10` |
| Valószínűség | egész % | `61%` |
| Különbség | egész pp, előjellel | `+7 pp` |
| EV | egész %, előjellel | `+10%` · `−3%` (valódi mínuszjel `−`) |
| Pénz | egész Ft, ezres **szóköz** (U+00A0 vagy U+202F) | `3 096 Ft` |
| Egység | 1 tizedes | `+0,9 egység` |
| Időpont | `ma 15:00`, `holnap 18:30`, egyébként `V 14:00` (nap-rövidítés) | |
| Dátum (H2H) | `ÉÉÉÉ.HH` | `2025.04` |
| Eredmény | nagykötőjel | `2–0` |
| Párosítás | szóköz + nagykötőjel + szóköz | `Arsenal – Chelsea` |
| Adat kora | óra, ha < 48 ó | „Az odds 30 órás” |

Megvalósítás: `Intl.NumberFormat('hu-HU', …)` egy közös `format.ts`-ben; a komponens
sosem hív `toFixed`-et.

## 9. Domain-képletek a UI-ban

A számítás a tiszta magban van (PRD 12.), a UI ezeket az értékeket kapja:

```
fair p (piac)      = (1/odd_i) / Σ(1/odd)
EV                 = p_modell × odds − 1
edge (pp)          = round((p_modell − p_piac) × 100)
min. odds          = (1 / p_modell) × (1 + EV-küszöb)          // küszöb alapból 5%
kötés eredő odds   = Π odds_i
kötés esély        = Π p_i                                     // függetlenséget feltételez
kötés EV           = Π p_i × Π odds_i − 1
kötés min. odds    = Π min_i
szingli-összevetés = Σ (p_i × odds_i − 1) × tét
nyeremény          = tét × eredő odds
kockázat           = esély ≥ 35% → low · 15–35% → medium · < 15% → high
```

Szabályok: ugyanarról a meccsről két tipp **nem** kerül egy szelvényre (a toggle
letiltva, `title` magyarázattal). A szelvény-értékek **a beírt Tippmix-oddsokkal** számolnak,
ha vannak, különben a legjobb odds-szal, és ezt felirat jelzi („becsült”).

## 10. Mikrocopy-szótár

| Helyett | Ezt írd |
|---|---|
| Modell / Piac | **Szerintünk / Irodák szerint** |
| Value | **érték**, „+7 pp érték a javunkra” |
| Minimum odds | **Tippmix min.** (kártyán), „Tippmixen legalább” (kiemelt helyen) |
| Add to slip | **+ Szelvényre** / **✓ Szelvényen** |
| Accumulator | **kötés** (Dupla / Hármas kötés), system → **Rendszer 2/3** |
| Confidence | **bizonyosság: alacsony / közepes / magas** |
| Place bet | **Tippmixre viszem** → **Megtettem** |
| Form | **Gy / D / V** |

Hangnem: tegeződő, rövid, tényszerű. Nincs „biztos tipp”, „garantált”, felkiáltójel.

## 11. Akadálymentesség

- Fókusz: `outline: 2px solid accent; offset 2px` (`:focus-visible`), sosem kikapcsolva.
- Toggle-ök: `aria-pressed`; lenyitó: `aria-expanded` + `aria-controls`; nav: `aria-current`.
- Form-chip sor: `<ol aria-label="Bologna utolsó 5: Gy D V Gy D">`.
- Tabella-sáv: `aria-label="Bologna 7., Lazio 6. a 20-ból"`, a cellák dekorációk.
- Ikon-gomb: mindig `aria-label`. Dekor-SVG: `aria-hidden="true"`.
- `prefers-reduced-motion`: animáció nélkül.
- Érintési cél ≥ 44 px (kivéve a nem kattintható chipeket).

## 12. Tilos / kötelező

| Tilos | Helyette |
|---|---|
| Nyers hex/px a komponensben | token |
| Második „kiemelőszín” dekorációnak | egy accent, a többi jelentés-szín (§5) |
| Színnel egyedül jelzett állapot | szín + betű/szöveg |
| `div onClick` | `<button>` |
| Gradiens, glow, üveghatás, emoji ikon | lapos felület, 1 px keret, stroke SVG ikon |
| A H2H/forma-részletek alapból nyitva mindenhol | egyszerre egy nyitott kártya |
| Pontos tizedes (`1.8`) | `1,80` |
| Kötés esélye elrejtve | mindig látszik, kockázat-színnel |
| Élő API-hívás UI-ból | csak DB / saját API (PRD 5.7) |

## 13. React/MobX komponensfa (javaslat)

```
<AppShell>                      // AppHeader + tartalom
  <RecommendationsPage>         // store: RecommendationStore, SlipStore
    <PageIntro modeSwitch />
    <EngineBanner />            // ha mode === 'engine'
    <SlipPresets />             // opcionális (D2)
    <DaySection title="Ma">
      <TipCard>                 // observer
        <TeamForm /> <ProbabilityBars /> <TipActions />
        <Disclosure>
          <MatchDetails> <LeagueStrip/> <H2HList/> <RecentList/> <RecentList/> </MatchDetails>
        </Disclosure>
      </TipCard>
    </DaySection>
    <SlipPanel>                 // asztal: aside · mobil: <SlipBar/> + <BottomSheet>
      <SlipLegs/> <SlipTotals/> <RiskMeter/> <StakeSelector/> <TippmixTransfer/>
    </SlipPanel>
  </RecommendationsPage>
</AppShell>
```

```ts
// SlipStore (MobX) – a képletek a tiszta magból jönnek (core/slip.ts)
selectedIds: number[]; mode: 'engine' | 'manual'; stake: number;
tippmixOdds: Record<number, number | undefined>;
get legs(); get combinedOdds(); get combinedP(); get ev(); get minOdds();
get risk(): 'low' | 'medium' | 'high'; get singlesExpected();
toggle(id); applyPreset(presetId); setStake(v); setTippmixOdds(id, v);

// UI-állapot (RecommendationStore vagy lokális): openCardId: number | null
```

---

*Verzió: 0.1 · 2026-11-12 · forrás: football-app design-vászon (D1–D3). Minden szám a
tervekben mintaadat.*
