# Változás-specifikáció – „Floodlight v0.2” átalakítás

Minden pontnál: **mit** változtatunk, és **mikor kész** (elfogadási feltétel).
Vizuális forrás: `reference/*.html` (megnyitható, sötét/világos váltóval) és `screens/*.png`.
Stílus- és tokenszabályok: `design/DESIGN.md`.

> A tervekben szereplő számok a 2025. áprilisi mentett adatból vagy mintából valók.
> Az appban **minden érték a meglévő adatból / store-ból jön**, semmi nincs beégetve.

---

## 0. Alap: tokenek és téma

**Mit**
- `design/` mappa a repóba (`frontend/src/design/`), `tokens.css` + `components.css` betöltése a belépési pontban.
- A meglévő, kézzel írt színek, térközök és betűméretek kiváltása tokenekre (`var(--…)` / `v('…')`).
- Sötét + világos téma: `data-theme` a `<html>`-en, preferencia `localStorage['oe-theme']`, hiánya = rendszer.
  Villanásmentes inline script az `index.html` `<head>`-jében (minta: `reference/ma.html`).
- Témaváltó gomb a fejlécben.

**Kész, ha**
- [ ] Nincs nyers hex/rgb a komponensekben (kivéve a generált `tokens.*` fájlokat). Ellenőrzés: `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" src --include=*.tsx --include=*.ts --include=*.css` csak a `design/tokens` alatt talál.
- [ ] Váltás után minden oldal (Ma, Kiértékelés, Arbitrázs, Beállítások) helyesen jelenik meg mindkét témában, újratöltés után megmarad a választás.
- [ ] Első betöltéskor nincs sötét→világos villanás.
- [ ] A chartok (kalibráció) színe témaváltáskor követi a témát.

## 1. Közös keret (minden oldal)

**Mit**
- Fejléc: logó · pill-navigáció (Ma · Kiértékelés · Arbitrázs · Beállítások, aktív = `aria-current`, semleges kitöltés) · jobbra `.oe-status-pill` („Mentett adat · 0/100 hívás”, `data-state`) · `.oe-theme-toggle`.
- **Kompakt oldalcímek:** a nagy, kétsoros cím csak a Ma oldalon marad. Kiértékelés, Arbitrázs, Beállítások: 32 px cím + meta-chipek (`.oe-meta-chip`), a szűrők jobbra.
- **Kiemelés-fegyelem:** a kiválasztott chipek/szegmensek/tétek semlegesek (`on.bg`), az accent csak értékre, fő CTA-ra, „szelvényen” állapotra.

**Kész, ha**
- [ ] A Kiértékelés oldal első képernyőjén (1440×900) a cím + ítélet-sáv + sikermutatók eleje látszik (a régi 3 soros cím nincs).
- [ ] A Beállításokban a kiválasztott irodák/piacok nem türkiz kitöltésűek, hanem semlegesek.

## 2. Ma oldal  → `reference/ma.html`, `screens/ma-*.png`

**Mit**
1. **Adat-állapot sor** a cím alatt: `.oe-pill--warning` („Mentett adat · 2025. ápr. 12–13.”) + mellékchipek („Odds 17 órás”, „Sérültlista nincs a forrásban”) + „Mit jelent?” lenyitó a teljes magyarázattal. A régi nagy keretes doboz megszűnik.
2. **„Kész szelvények” a szelvény-panel üres állapotába költözik** (a lista feletti blokk megszűnik). Presetek a §8.2 szabály szerint (DESIGN.md). Kattintás → szelvény feltöltése.
3. **Szelvény-panel** `position: sticky` asztali nézetben; kitöltött állapot a referencia szerint (lábak, eredő odds + Tippmix min., EV, esély + kockázat, tét, nyeremény, „Tippmixre viszem”, „Szelvény ürítése”).
4. **Tippkártya átrendezése** (DESIGN.md §6 „Ma – tippkártya”):
   - jobb felső sarokban nagy EV;
   - három döntési csempe (legjobb odds · Tippmixen legalább · esély szerintünk/irodák sávval);
   - „Miért?” csipek: max. 3, csak a kiválasztott kimenetre ható tényezők;
   - forma-sor a helyezéssel;
   - két egyenrangú gomb: „+ Szelvényre” és a lenyitó.
   - A „Pinnacle · P 16:00 · tét 1 egység · elo-poisson@0.1.0” sor a lenyitott részbe kerül (`.oe-tip__source`).
5. Lenyitott rész: teljes indoklás (a mostani „Miért?” lista), tabella-sáv, egymás ellen, két „utolsó 5”.

**Kész, ha**
- [ ] Üres szelvénynél a panel presetet kínál; preset-kattintás után a kártyák `✓ Szelvényen` állapotba váltanak.
- [ ] Egy 1X2 tippnél a gólpiacra ható tényező (pl. „Gólszegény csapatok”) nem jelenik meg a csipek között, csak a lenyitott indoklásban.
- [ ] Szingli 3,00 odds, 1 000 Ft tét → „3 000 Ft”; dupla 3,00 × 3,23 → „9,69”, esély 12%, „kb. minden kilencedik” (unit teszt a magra).
- [ ] 390 px-en: a szelvény a lista alá kerül, nincs vízszintes görgetés, a csempék egymás alá törnek.
- [ ] A lista továbbra is 0 külső hívással töltődik (PRD 7.1).

## 3. Kiértékelés oldal  → `reference/kiertekeles.html`, `screens/kiertekeles-*.png`

**Mit**
1. Kompakt fej: „Kiértékelés” + meta-chipek (modellverzió, szezonok, meccsszám, value-küszöb); jobbra piac-szegmens + szegmens-select.
2. **Ítélet-sáv** (`.oe-verdict`) a metrikákból számolva (DESIGN.md §8.3).
3. **Sikermutatók táblája** a PRD 9. fejezet céljaival, `✓ Teljesül / ✗ Nem teljesül` pillekkel és „N / 5 teljesül” számlálóval.
4. **KPI-k viszonyítással:** value tippek (talált arány sávval), találati arány a várthoz (`.oe-compare`), ROI 95%-os sávval a nullához (`.oe-ci`), CLV.
5. **Pontosság táblázat** delta-pillekkel, a záró piac sora „legjobb” címkével kiemelve.
6. **Kalibráció:** nagyobb grafikon (`--size-chart` 380 px) + rendes táblázat (sáv, becsült, tényleges, eltérés, minta), kiemelés ha |eltérés| ≥ 5 pp és n ≥ 30; n < 30 halványítva, csillaggal; egy mondatos értelmezés alatta.

**Kész, ha**
- [ ] Az ítélet és a pillek a tényleges metrikákból jönnek (unit teszt: a mostani számokkal „negative”, 2/5 teljesül).
- [ ] A ROI-sáv skálája és a nulla-jel helyes negatív és pozitív ROI-ra is.
- [ ] A kalibrációs pont mérete a mintával arányos (`8 + √n / 4,5` px).
- [ ] 390 px-en a táblák a saját dobozukban görgethetők, az oldal nem.

## 4. Arbitrázs oldal (nincs külön terv – a közös elemekből)

**Mit**
- Cím: „Arbitrázs” + alcím-chip „Irodák közötti árkülönbségek” (a „Garantált hozam” kifejezés megszűnik).
- Jól látható `.oe-pill--warning`: „Történeti adat: 2024/25 nyitó oddsok – nem megtehető fogadás”.
- **Hibajavítás:** „Arbitrázs” címke csak akkor, ha a kerekített tétekkel számolt legkisebb kifizetés ≥ összes tét (most a Monza–Napoli −3 Ft-tal is címkét kap). Ha a kerekítés miatt negatív: „Közeli” címke.
- A kártyák maradnak; a kiválasztott szűrő-szegmens semleges.

**Kész, ha**
- [ ] Unit teszt: Σ1/odds < 1, de kerekítés után negatív kifizetés → nem „Arbitrázs”.
- [ ] A „garantált” szó sehol nem szerepel.

## 5. Beállítások oldal (nincs külön terv – a közös elemekből)

**Mit**
- Kompakt cím; bal oldali szekció-menü (Ligák · Piacok és irodák · Tárolás · Stratégia · Megjelenés), mobilon felül vízszintes chip-sor.
- Liga-kártyákon a coverage-címkék közül **csak a hiányzó** jelenjen meg, warning színnel („Sérültek nincs”).
- Kiválasztott piac/iroda: semleges kitöltés (`on.bg`) vagy jelölőnégyzet, nem türkiz.
- „Megjelenés” szekció: Téma – Rendszer / Sötét / Világos.
- Alul ragadó mentés-sáv, ha van változás: „Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB · [Elvetés] [Mentés]”.

**Kész, ha**
- [ ] A teljes liga-lista egy képernyőn átlátható; a három azonos címke nincs ismételve minden kártyán.
- [ ] A téma-választás itt és a fejlécben ugyanazt a preferenciát állítja.

## 6. Ami NEM változik
- Üzleti logika, modell, ingestion, API-kliens, DB-séma.
- A meglévő útvonalak és oldalnevek – a navigáció sorrendje és kinézete változik, az URL-ek nem.
- PRD nem-célok (8. fejezet).
