# Előrejelzési és ajánlási módszertan (kezdeti terv)

> **Státusz:** Tervezet · **Utolsó frissítés:** 2026-11-12 · **Tulajdonos:** Martin
>
> Ez a terv **fokozatosan építhető**: minden szint önmagában működik és mérhető, a
> következő szint csak akkor jön, ha az előző mérhetően hozza a célt. A számok
> (küszöbök, súlyok) **kezdőértékek**, és a backtest írja felül őket.
>
> Kapcsolódó dokumentumok: [`../PRD.md`](../PRD.md) (célok, sikermutatók) ·
> [`../architecture.md`](../architecture.md) (adatmodell) ·
> [`../api/api-football.md`](../api/api-football.md) (végpontok, hívásköltség)

---

## 1. Alapelvek

1. **Először valószínűség, utána tipp.** A modell piaconként kalibrált valószínűséget ad.
   Az ajánlás ebből és az oddsból származik (EV), nem egy „ki nyer” döntésből.
2. **A piac a legerősebb baseline.** A margin-mentes odds nehezen verhető. A modellnek
   mérhetően hozzá kell tennie valamit, különben nincs ajánlás.
3. **Megmagyarázhatóság.** Minden ajánláshoz tartozik a tényezők hozzájárulása
   (százalékpontban). Fekete dobozt nem élesítünk (PRD nem-cél).
4. **Reprodukálhatóság.** Minden predikció mellé elmentjük a modellverziót, a
   feature-pillanatképet és az akkori oddsot. A backtest pont-idejű: csak az akkor
   ismert adatot használja.
5. **Hívás-takarékosság.** A feature-ök amennyire lehet a **saját DB-ből** számolódnak
   (forma, H2H, tabella-idősor). Az API-ból csak az jön, ami máshonnan nem szerezhető
   meg (odds, sérültek, aktuális meccsek).

## 2. Piacok

| Verzió | Piac | Kód (`BetTypes.ts`) | Kimenetelek |
|---|---|---|---|
| v1 | Végeredmény (1X2) | `Vegeredmeny` (`Match Winner`) | Home / Draw / Away |
| v1 | Gólszám 2.5 | `GolokSzama` (`Goals Over/Under`) | Over 2.5 / Under 2.5 |
| v2 | Mindkét csapat szerez gólt | `MindketCsapatGol` (`Both Teams Score`) | Yes / No |
| v2 | Kétesélyes | `KeteselyesVegeredmeny` (`Double Chance`) | 1X / 12 / X2 (az 1X2-ből levezethető) |
| v3 | Többi gólvonal (1.5, 3.5), hazai/vendég gólok | `GolokSzama`, `HazaiGolokSzama`, `VendegGolokSzama` | — |

A Poisson- és Dixon–Coles-modell **egyetlen eredménymátrixból** (P(hazai = i, vendég = j))
adja mindegyik gólpiacot. Ezért a piacok egymással konzisztensek, és a v2–v3 piacok olcsón
hozzáadhatók.

## 3. Tényezők (feature-ök)

| Tényező | Definíció (javaslat) | Adatigény | Forrás (API-végpont / DB) | Hívásköltség | Verzió |
|---|---|---|---|---|---|
| **Csapaterő (Elo)** | Elo-értékelés, gólkülönbséggel súlyozott K-faktorral, hazai előnnyel; szezonváltáskor visszahúzás az átlag felé (pl. 1/3) | teljes meccstörténet, ≥ 2 szezon | `fixtures?league&season` (backfill) → `fixture` | szezononként és ligánként 1 | v1 |
| **Támadó- és védőerő** | Poisson- vagy Dixon–Coles-paraméterek (att, def, hazai előny) időbeli lecsengéssel (ξ) | meccseredmények | `fixture` | 0 (DB) | v1 |
| **Forma** | Az utolsó 5–10 meccs pont/meccs és gólkülönbség, exponenciálisan súlyozva; **ellenfél-erővel korrigálva** (Elo-reziduum) | meccseredmények | `fixture` | 0 | v1 |
| **Hazai / vendég bontás** | Külön hazai és vendég att/def, vagy csapatonkénti hazai előny (shrinkage-dzsel) | meccseredmények | `fixture` | 0 | v1 (globális) → v2 (csapatonként) |
| **Lövésalapú forma** | Kapura lövések és összes lövés aránya (rúgott vs. kapott), az utolsó N meccsre | meccsstatisztika | `fixtures?ids` → `fixture_team_stats` | 20 meccsenként 1 | v2 |
| **H2H** | Az utolsó max. 6 egymás elleni meccs gólkülönbségének átlaga, **erős shrinkage-dzsel** (kevés minta, gyenge jel) | meccsek, több szezonon át | `fixture` (a `fixtures/headtohead` csak akkor, ha nincs a DB-ben) | 0 (DB) | v2 |
| **Tabellahely** | Helyezés, pont/meccs, pontkülönbség a szomszédos zónákhoz | tabella a meccs előtti állapotban | `standings` (élő) / `standing_derived` (backtest) | ligánként, fordulónként 1 | v1 |
| **Motiváció / tét** | Lásd 3.1 | tabella + hátralévő fordulók + zónahatárok | `standings` (`description` mező: „Promotion - Champions League”, „Relegation”) + `fixture` | 0 (a tabellán felül) | v2 |
| **Szezonszakasz** | Forduló / összes forduló → `eleje` (≤ 20%), `közepe`, `hajrá` (≥ 80%) és a tabella-tier (top 4 / közép / alsó 4) **interakciója** | több szezon | `fixture`, `standing_derived` | 0 | v2 |
| **Sérültek és eltiltottak** | `Missing Fixture` darabszám (a `Questionable` fél súllyal), v3-ban játékos-fontossággal súlyozva (percek aránya / rating) | meccs előtti sérültlista | `injuries?ids` (max. 20 meccs / hívás) | meccsnaponként és ligánként ≈ 1 | v2 (darab) → v3 (súlyozott) |
| **Sűrű program** | A legutóbbi meccs óta eltelt napok (a kupát és az Európa-kupát is beleértve); a 4 napnál kevesebb jelzés | minden sorozat meccsei a csapatra | `fixture` (ha az UCL/UEL is be van állítva) vagy `fixtures?team&last=1` | 0–2 / meccs | v3 |
| **Piaci valószínűség** | Margin-mentes fair valószínűség a legjobb és az átlag oddsból (lásd 4.1) | odds-snapshot | `odds` → `odds_quote` | lásd budget | v0 |
| **API-predikció** | A `/predictions` `percent` (1X2) mezője | — | `predictions?fixture` | meccsenként 1 | v1 (csak a jelöltekre, benchmarkként) |

### 3.1 Motiváció és tét (javasolt definíció)

Minden csapatra a meccs előtt, `R` hátralévő fordulóval:

- `max_szerezheto = 3 × R`
- Releváns zónák a `standings.description` mezőből: bajnoki cím (1.), BL-zóna, EL/ECL-zóna,
  kieső zóna, osztályozó.
- Minden zónára: `rés = pontkülönbség a zónahatárhoz`, ahol a zónába bejutás pozitív, a
  zónából kiesés negatív irányt jelent.
- **Állapotok:**
  - `eldőlt` (a rés > `max_szerezheto`, egyik irányban sem változhat),
  - `élő` (a |rés| ≤ `max_szerezheto`),
  - `kritikus` (élő, és a |rés| ≤ 3 vagy R ≤ 5).
- **Feature-ök:** `motivacio_hazai` és `motivacio_vendeg` ∈ {semleges, élő, kritikus}, a
  zóna típusával együtt (cím / Európa / kiesés), és a kettő **különbsége**.
- **Csak a szezon második felében számít** (R ≤ a fordulók fele). Előtte semleges.

> Ez a tulajdonos „tét”-intuíciójának formalizálása. Hogy tényleg előrejelző-e, azt a
> 2022–2024-es backtest mondja meg (6. fejezet). Ha nem az, a súlya 0 lesz, de a feature
> megmarad az indoklásban (pl. „A vendég már nem játszik semmiért”).

## 4. Modellek

### 4.0 B0: piaci baseline (v0)

1. Fogadóirodánként a kimenetelek implikált valószínűsége `1/odd`.
2. **Margin-mentesítés:** v0-ban arányos normalizálás, `p_i = (1/o_i) / Σ_j (1/o_j)`. Ez
   torzít (favorit–esélytelen torzítás), ezért később a power- vagy Shin-módszer jöhet,
   és a választást a kalibráció dönti el.
3. **Konszenzus:** a fair valószínűségek mediánja az irodák között. A „legjobb odds” külön
   mező, mert az EV-hez kell, a valószínűséghez nem.

Ez a **v0 modell is**: a logolás és a kiértékelés teljes körét ezen kell végigvinni (5. fejezet),
mielőtt saját modell készül. Ennek a modellnek nem lesz value-ajánlása, mert definíció szerint
EV ≈ −margin. Viszont kiderül belőle, hogy a pipeline működik.

### 4.1 B1: API `/predictions`

A `percent.home/draw/away` mezőt 1X2-valószínűségként naplózzuk (`model_version = api-predictions@1`),
és **benchmarkként** értékeljük ki. Költség: meccsenként 1 hívás, ezért csak a jelöltekre
és / vagy egy ligára (lásd [`api-football.md` §4.4](../api/api-football.md#44-predictions-mit-ad-és-hogyan-használjuk)).

### 4.2 M1: Elo → 1X2 (v1, egyszerű és robusztus)

- Elo-frissítés minden meccs után: `ΔR = K · G(gólkülönbség) · (S − E)`, ahol
  `E = 1 / (1 + 10^(−(R_h + H − R_a)/400))`.
- **Valószínűség:** ordinális logit az `R_h + H − R_a` különbségen, a 2022–2024-es meccseken
  illesztve (két küszöb: hazai / döntetlen / vendég).
- Előny: kevés paraméter, kevés adat is elég, könnyű elmagyarázni („a hazai 85 Elo-ponttal erősebb”).

### 4.3 M2: Poisson / Dixon–Coles (v1–v2, minden gólpiacra)

- `λ_hazai = exp(μ + hazai_előny + att_h − def_a)`, `λ_vendég = exp(μ + att_a − def_h)`.
- **Dixon–Coles-korrekció** az alacsony eredményekre (0–0, 1–0, 0–1, 1–1, ρ paraméter), és
  időbeli lecsengés: a súly `exp(−ξ · napok)`.
- Az eredménymátrixból (0–10 gól) jön az 1X2, az O/U 2.5 és a BTTS.
- Illesztés maximum-likelihood módszerrel, ligánként, gördülő ablakon (pl. az utolsó 2 szezon).

### 4.4 Korrekciós réteg (v2): a „tulajdonos-szempontok”

A kontextusfaktorok **szorzóként módosítják a λ-kat** (log-lineárisan). Így a hatásuk
egyszerre értelmezhető és illeszthető:

```
log λ_h' = log λ_h + β_mot · motiváció_h + β_inj · hiányzók_h + β_rest · pihenő_h + β_phase[szakasz, tier_h] + ...
```

- A `β` együtthatók **Poisson-regresszióval (GLM)** illeszthetők a 2022–2024-es adaton, offsetként
  az M2 `log λ` értékével. Így csak azt tanulják meg, amit az alapmodell még nem tud.
- **Regularizáció** (ridge, vagy egyszerűen a kis minta miatt erős shrinkage), mert
  sok a faktor és kevés a meccs.
- **Az indoklás** ebből közvetlenül jön: egy faktor hozzájárulása = a valószínűség
  változása (százalékpontban), ha a faktort 0-ra állítjuk (ablációs bontás). Ez a
  `prediction.explanation`.

### 4.5 Kombinálás a piaccal (v2–v3)

A saját modell és a piac **logit-térbeli súlyozott átlaga**:

```
logit(p_végső) = w · logit(p_modell) + (1 − w) · logit(p_piac)
```

- A `w` értéket a backtest log-loss minimalizálásával állítjuk be. **Tipikusan kicsi** (a
  piac erős). Ha `w ≈ 0`, a modell nem tesz hozzá semmit, és ezt jelezni kell.
- Ez **csökkenti a hamis value-t**: egy nagy modell–piac eltérés gyakrabban modellhiba,
  mint valódi lehetőség.
- 1X2-nél a 3 kimenetelre multinomiális formában, utána renormalizálva.

## 5. Value, EV, ajánlási szabály

| Lépés | Képlet / szabály | Kezdőérték |
|---|---|---|
| EV | `EV = p_végső × odd_legjobb − 1` | — |
| Ajánlás feltétele | `EV ≥ küszöb` **és** `p_végső − p_piac ≥ min_eltérés` **és** `min_odds ≤ odd ≤ max_odds` **és** `n_iroda ≥ 5` **és** nincs blokkoló adatminőségi figyelmeztetés | küszöb 5%, min_eltérés 2 pp, odds 1.50–4.00 |
| Minimális vállalható odds | `odd_min = (1 + küszöb) / p_végső` | a tulajdonos ehhez méri a Tippmix-oddsot |
| Bizonyosság | magas / közepes / alacsony: a modellek (M1, M2, API) egyetértése, a mintaméret (lejátszott meccsek a szezonban), és az adat frissessége | — |
| Egy meccs, több piac | meccsenként legfeljebb 1 ajánlás (a legnagyobb EV-jű), mert a piacok korreláltak | — |
| Blokkoló figyelmeztetés | az odds régebbi 36 óránál; a szezonban 4-nél kevesebb meccs a csapatnak; hiányzik a sérültlista, és a liga `coverage.injuries = true` | — |

## 6. Tétkezelés

| Mód | Szabály | Mikor |
|---|---|---|
| **Flat (alapértelmezett)** | 1 egység minden ajánlásra | amíg nincs 300+ kiértékelt ajánlás, és nem igazolt a kalibráció |
| **Tört-Kelly (opcionális)** | `f* = (p·o − 1) / (o − 1)`, ennek **¼**-e, felső korlát a bankroll 2%-a | csak ha a kalibráció hibája < 5 pp, és a CLV átlaga > 0 |

A ROI-t a kiértékelés **mindig flat téttel** is kiszámolja, hogy a modellverziók
összevethetők legyenek.

## 7. Tanulási kör

### 7.1 Naplózás (minden predikciónál, nem csak az ajánlásnál)

`prediction` sor (séma: [`architecture.md` §10.4](../architecture.md#104-modell-predikció-kiértékelés)):
a modellverzió, `p_model`, `p_market_fair`, a használt odds-snapshot, a legjobb odds és az
iroda, EV, `is_recommendation`, **`features` (a teljes bemenet)**, **`explanation`**,
`warnings`. **Append-only.** Ha a modell változik, új verzió jön, a régi sor marad.

### 7.2 Kiértékelés (automatikus, a meccs után)

| Mutató | Képlet | Megjegyzés |
|---|---|---|
| Kimenetel | win / loss / void (PST, CANC, ABD) | a rendes játékidő eredménye alapján |
| Profit (flat) | win: `odd − 1`, loss: `−1` | a `best_odd`-dal és a ténylegesen megtett `placed_bet.odd_taken`-nel külön |
| **Brier (1X2)** | `Σ_k (p_k − y_k)²` | a piaci és az API-baseline-nal együtt |
| **Log-loss** | `−log p_bekövetkezett` | |
| **Kalibráció** | 10%-os vödrönként a vödör átlagos p-je vs. a bekövetkezési arány | görbe a dashboardon |
| **CLV** | `odd_ajánláskor / odd_záró-közeli − 1` | a záró-közeli odds az utolsó snapshot a kezdés előtti ≤ 3 órából. Ha nincs ilyen, nincs CLV. |
| Találati arány vs. várt | a ténylegesen bejött tippek aránya vs. az átlagos `p_végső` | ha nagyon eltér, kalibrációs hiba van |

### 7.3 Statisztikai óvatosság

Ha a tipp oddsa `o` és a valószínűség ≈ `1/o`, egy flat tipp profitjának szórása ≈ `√(o − 1)`.
Átlagos 2.0-s oddsnál **n tipp után a ROI standard hibája ≈ 1/√n**:

| n | ROI standard hibája | ~95%-os „zajsáv” |
|---|---|---|
| 100 | 10% | ±20% |
| 300 | 5,8% | ±11,5% |
| 1 000 | 3,2% | ±6,3% |

→ **A ROI csak nagy mintán értelmezhető.** Korai visszajelzésre a **Brier, a log-loss és a
CLV** a jobb. Ezek sokkal kevesebb mintából is stabilak, és minden predikcióra számolhatók,
nem csak az ajánlásokra.

### 7.4 Backtest

- **Adat:** 2022–2024 (ami a free csomagban elérhető). A meccsek és a statisztikák az API-ból
  jönnek (backfill), az **odds a football-data.co.uk CSV-kből** (nyitó és záró,
  [`api-football.md` §7.3](../api/api-football.md#73-történeti-odds-a-backtesthez-football-datacouk)).
- **Walk-forward:** fordulóról fordulóra haladunk, minden predikció csak az aznap előtti
  adatból készül (`standing_derived` `as_of`, az Elo és a Poisson csak a múltbeli meccseken
  illesztve).
- **Ami a backtestben nem érhető el:** a pont-idejű sérültlista (az API `injuries` 2021-től
  van, de meccsenként kellene lehívni, és a rögzítés időpontja nem ismert). **A sérültfaktort
  csak élő naplóból lehet kiértékelni.** Ezt jelezni kell.
- **Holdout:** a 2024-es szezon zárolt. Csak a végső összevetéshez használjuk, hangolásra nem.
  Minden kipróbált változat bekerül a naplóba (`prediction_run`, `trigger = backtest`), hogy a
  „sokszor próbálkoztunk, egyszer bejött” torzítás látható maradjon.

### 7.5 Modell-életciklus

`dev` → **`shadow`** (élesben naplóz, de nem ajánl; legalább 4 hét vagy 150 predikció) → `live` → `retired`.

**Élesítési feltétel (javaslat):** a holdoutban és a shadow-időszakban is (a) a Brier és a log-loss
legalább olyan jó, mint a piaci baseline-é, **és** jobb, mint az API-predikcióé; (b) a kalibráció
eltérése < 5 pp; (c) a CLV átlaga ≥ 0. A ROI-t ekkor még csak tájékoztatásként nézzük.

### 7.6 Iteráció

Havonta egy áttekintés: melyik faktor `β`-ja stabil, melyik zajos; ligánkénti eltérések; az
ajánlási küszöbök hangolása (az EV-küszöb vs. a CLV görbéje). A változás mindig új
modellverzió, saját backtesttel.

## 8. Építési sorrend

| Szint | Tartalom | Feltétel a továbblépéshez |
|---|---|---|
| **v0** | Piaci baseline + teljes naplózás és kiértékelés + dashboard | a pipeline végigfut, és a kiértékelés automatikus |
| **v1** | Elo (M1) + Poisson / Dixon–Coles (M2), 1X2 + O/U 2.5; API-predikció benchmarkként | backtest: a Brier ≤ a piacé ± 1%, és jobb az API-predikciónál |
| **v2** | Korrekciós réteg (motiváció, szezonszakasz, sérültek, lövésforma) + piaci kombinálás (`w`); BTTS | a korrekciós réteg csökkenti a log-losst a holdouton |
| **v3** | Súlyozott sérültek, sűrű program, ligánkénti paraméterek, tört-Kelly | igazolt kalibráció + pozitív CLV az élő naplóban |

## 9. Adatigény összefoglaló

| Adat | Mire kell | Forrás | Mikor kell meglennie |
|---|---|---|---|
| Meccseredmények (≥ 2 szezon) | Elo, Poisson, forma, H2H, tabella-idősor, szezonszakasz | API backfill (2022–2024) + a folyó ingestion | v1 előtt |
| Meccsstatisztika | lövésforma | `fixtures?ids` backfill | v2 előtt |
| Aktuális tabella | tabellahely, motiváció | `standings` | v1 (élő) |
| Odds-snapshot (korai, késői) | piaci baseline, EV, CLV | `odds` (élő) | v0 |
| Történeti odds | backtest EV, ROI, CLV | football-data.co.uk CSV | v1 backtest előtt |
| Sérültek | sérültfaktor | `injuries?ids` (élő) | v2 (csak élőben értékelhető) |
| API-predikció | benchmark | `predictions` (jelöltekre) | v1 |
