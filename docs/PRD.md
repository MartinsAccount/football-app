# PRD: football-app

> **Státusz:** Élő dokumentum · **Utolsó frissítés:** 2026-11-12 · **Tulajdonos:** Martin
>
> Ez a projekt „észak-csillaga”. Minden új funkció-ötletet ehhez mérünk. Ha egy ötlet nem
> szolgálja az itt leírt célokat, vagy nem-célt érint, előbb ezt a dokumentumot kell
> módosítani (tudatos döntéssel), és csak utána a kódot.
>
> **Változás az előző verzióhoz képest:** a fő funkció a **meccselemzés és
> tippajánlás** lett. Az arbitrázs önálló, másodlagos modul. Az app **hosztolt** lesz,
> **adatbázissal** és ütemezett adatgyűjtéssel. A korábbi feltevések („csak lokális,
> nincs hosztolás, a value bet másodlagos”) érvényüket vesztették.

Kapcsolódó dokumentumok: [`ROADMAP.md`](ROADMAP.md) · [`architecture.md`](architecture.md) ·
[`api/api-football.md`](api/api-football.md) · [`analysis/strategy.md`](analysis/strategy.md)

---

## 1. Probléma

A tulajdonos focira fogad (Tippmix), és a meccs előtti elemzést ma kézzel végzi. Megnézi
a H2H-t, a tabellát, azt, hogy mi a tétje a meccsnek az egyes csapatoknak (bajnoki
cím, kiesés, „már nincs miért játszani”), a sérülteket és eltiltottakat, a formát, és
mélyebben a korábbi szezonokat, a meccsdinamikát és a **szezonszakaszokra jellemző
mintákat** (pl. hogyan teljesít a tabella eleje és vége a szezon különböző részeiben).

Ez lassú. Nem skálázható sok meccsre. Nem rögzíti, mire alapozott, és **nem tanul**:
nem derül ki, melyik szempont volt utólag tényleg előrejelző, és hosszú távon nyereséges-e
a tulajdonos stratégiája.

## 2. Cél

Az app **automatizálja a tulajdonos meccs előtti elemzését**:

1. A kiválasztott ligák közelgő meccseit és oddsait kódból elemzi, és egy stratégia
   alapján **tippeket ajánl, indoklással**.
2. **Minden ajánlást és oddsot eltárol**, a meccs után **automatikusan kiértékeli**, és
   idővel méri a pontosságot, a kalibrációt és a ROI-t. Így a stratégia **mérhetően
   javítható**.
3. Mindezt **a napi API-kereten belül**, emberi beavatkozás nélküli ütemezett
   adatgyűjtéssel, hosztolt környezetben.

A tulajdonos tudja, hogy az előrejelzés soha nem biztos. A cél nem a „biztos tipp”,
hanem egy **mérhető, átlátható és javítható döntéstámogatás**.

## 3. Felhasználó

- **Egyetlen felhasználó: a tulajdonos.** Személyes eszköz. Nincs több-bérlős működés és
  nincs regisztráció.
- Az app **interneten elérhető** (hosztolt), ezért **egyszerű hozzáférés-védelem
  kell** (lásd 5.7).
- A felhasználó érti a fogadási fogalmakat (odds, 1X2, Over/Under, BTTS, value). A UI
  nem oktat, hanem gyors döntést támogat.
- Elsődlegesen asztali gépen használja. Mobilon az ajánlások listája legyen olvasható
  (reggeli átnézés).

## 4. Megkötések

| Megkötés | Következmény |
|---|---|
| **API-Football Free csomag: 100 hívás/nap**, korlátozott szezon-ablak (a tulajdonos döntése: a free csomag marad) | Minden funkciót hívásszámra kell tervezni: beállított ligák, saját DB-ből számolt feature-ök, kötegelés, mock mód a fejlesztéshez. Részletek: [`api/api-football.md` §6](api/api-football.md#6-hívás-budget). |
| ⚠️ **A Free csomag 2026 őszén közösségi források szerint csak a 2022–2024-es szezonokat engedi** | Ha ez igaz, a free csomagból **nem jön jelenidejű meccs és odds**, és a fő funkció adatforrás nélkül marad. **Első lépés a mérés** (ROADMAP 0.0), utána döntés (D1, 10. fejezet). |
| A pre-match odds az API-ban 1–14 nappal a meccs előtt érhető el, és **csak 7 napig őrzik** | Odds-historyt csak a saját, időben elmentett snapshotjaink adnak. Múltbeli oddsot külső forrásból töltünk (football-data.co.uk CSV). |
| Ingyenes hosting és DB (Vercel/Netlify, Neon/Supabase free tier) | Rövid futású függvények, korlátozott ütemezés és tárhely. Az ingestion kis, ismételhető lépésekből áll. Lásd [`architecture.md`](architecture.md). |
| Egy fejlesztő + AI-agent | A kód legyen tesztelhető és ellenőrizhető emberi kattintgatás nélkül (lásd 9. fejezet). |

## 5. Funkciómodulok

Prioritás: **P0** = a fő funkció működéséhez kell · **P1** = a fő funkció értékét adja ·
**P2** = később, vagy másodlagos.

### 5.1 Tippajánló motor (P0, **fő funkció**)

A beállított ligák közelgő meccseire **piaconként valószínűséget becsül**, összeveti az
elérhető oddsokkal, és **ajánlást ad**, ha a várható érték (EV) és a bizonyosság egy
küszöb fölött van.

- **Piacok, v1:** 1X2 (`Vegeredmeny`), Over/Under 2.5 (`GolokSzama`). **v2:** BTTS
  (`MindketCsapatGol`), Double Chance (`KeteselyesVegeredmeny`), további gólvonalak.
- **Bemeneti szempontok (feature-ök):** forma, hazai/vendég teljesítmény, H2H,
  tabellahely, **motiváció/tét** (bajnoki cím, európai kupahely, kiesés, „semleges”),
  sérültek és eltiltottak, **szezonszakasz**, rúgott és kapott gólok, sűrű program.
  Módszertan: [`analysis/strategy.md`](analysis/strategy.md).
- **Baseline-ok:** a piac (az oddsból számolt, margin-mentes valószínűség) és az API
  `/predictions` végpontja. A saját modellnek ezeket kell megvernie.
- **Kimenet:** ajánlások listája (lásd 6. fejezet: mit kell tartalmaznia).

### 5.2 Adatgyűjtés / ingestion (P0)

Ütemezett, budget-tudatos háttérfolyamat. Ez tölti a DB-t:

- törzsadat (ligák, csapatok, szezonok, `coverage`),
- meccsek és státuszuk, végeredmény, meccsstatisztika,
- tabella-snapshotok,
- sérültek és eltiltottak,
- **pre-match odds-snapshotok** (korai és kezdés előtti),
- napi hívásszámlálás és hívásnapló.

Követelmények: idempotens, újrafuttatható, a napi keretet soha nem lépi túl, és a
fontossági sorrendet tartja (a kezdés előtti odds-snapshot megelőzi a backfillt).

### 5.3 Beállítások / konfiguráció (P0)

- **Mely ligák** érdekelnek (és ebből adódóan mennyi hívás megy rájuk). A UI mutatja a
  liga becsült napi hívásköltségét és a `coverage` flageket (van-e odds, sérült, statisztika).
- **Opcionálisan csapatok:** csak bizonyos csapatok meccsei, vagy csapatok kizárása.
- Piacok, EV-küszöb, minimum- és maximum-odds, tét-mód (flat / Kelly-tört), alapegység.
- Napi hívás-tartalék a backfillnek.

### 5.4 Predikció-követés és tanulási kör (P0 → P1)

- **Minden ajánlás és minden predikció** (az ajánlásnak nem minősülők is) elmentésre
  kerül: a modellverzióval, a feature-pillanatképpel, az akkori oddsszal és az
  időbélyeggel együtt. **A rekord utólag nem módosítható** (append-only).
- A meccs után **automatikus kiértékelés**: találat/nem találat, profit flat téttel,
  Brier-pontszám, log-loss, CLV (a záró-közeli oddshoz mért érték).
- **Kiértékelő dashboard:** találati arány, ROI, kalibrációs görbe, CLV, idősorban,
  modellverziónként, ligánként és piaconként, a baseline-okkal összevetve.
- **Backtest:** egy modellverzió lefuttatása korábbi szezonokon (2022–2024) a
  pont-időben érvényes adatokkal, történeti odds ellen.
- **Stratégia-iteráció:** új modellverzió csak akkor lép élesbe, ha a backtestben és a
  korábbi éles időszakon is legalább a baseline szintjét hozza (lásd 7. fejezet).

### 5.5 Odds-history (P1)

- Időbélyeges snapshotok irodánként, piaconként és kimenetelenként.
- Meccs nézet: az odds mozgása (nyitó → záró-közeli), a legjobb odds és az iroda, a meccs
  utáni kimenetel, és az, hogy melyik odds volt utólag value.
- Ez a CLV és a kalibráció alapja is.

### 5.6 Arbitrázsmodul (P2, önálló)

- A meglévő funkció: irodák közötti legjobb odds, `Σ 1/odd < 1`, szűrés irodára,
  fogadástípusra és arány-sávra.
- **Független az ajánlómotortól**, csak a közös odds-adatot és a közös API-klienst használja.
- Új backendre költözik. Az odds-snapshotokból dolgozik (a beállított ligákon 0 extra hívás).
  A teljes piac pásztázása (`/odds/mapping`) opcionális, kézzel indítható, és
  budget-figyelmeztetés előzi meg.

### 5.7 Hosting és hozzáférés-védelem (P0)

- Hosztolt frontend és API (Vercel vagy Netlify, döntés: D2), menedzselt adatbázis
  (döntés: D3), ütemezett jobok.
- **Az API-kulcs csak szerveroldalon** létezik. A frontend soha nem hívja közvetlenül a
  külső API-t.
- **Egyfelhasználós hozzáférés-védelem** (döntés: D4). Az API-végpontok és a cron-végpontok
  is védettek (a cron titkos tokennel).

### 5.8 Meglévő oldalak sorsa

| Oldal | Ma | Jövő |
|---|---|---|
| `/arbitrage` | Arbitrázskereső (élő API + localStorage cache) | Az arbitrázsmodul (5.6) |
| `/odds` | Odds böngészése (backendes JSON-fájlok + statikus JSON) | Beolvad az odds-historyba (5.5) |
| `/fixtures` | Liga-statisztikák stat-kártyákon (statikus 2020-as JSON-okból) | Beolvad a meccs-részletes nézetbe és a feature-ök megjelenítésébe |
| *(új)* `/` vagy `/recommendations` | — | **Kezdőoldal: a mai és holnapi ajánlások** |
| *(új)* `/evaluation` | — | Kiértékelő dashboard |
| *(új)* `/settings` | — | Beállítások, API-budget kijelzés |

## 6. Mit kell tartalmaznia egy ajánlásnak

| Mező | Példa | Miért |
|---|---|---|
| Meccs, liga, kezdés (helyi idő) | Arsenal–Chelsea, PL, szo 18:30 | azonosítás |
| Piac és kimenetel | 1X2 → Hazai | mire kell fogadni |
| **Modell-valószínűség** | 52% | a becslés |
| **Piaci (fair) valószínűség** | 46% (a margin-mentes legjobb vagy átlag odds alapján) | a baseline-hoz mérve |
| **Legjobb elérhető odds és iroda** + az odds időbélyege | 2.25 @ Bet365, 09:12 | hol érdemes fogadni |
| **Minimális vállalható odds** (fair odds × (1 + EV-küszöb)) | ≥ 2.02 | Tippmixen ennél rosszabb oddsra ne fogadjon |
| **EV** | +17% | value mértéke |
| **Bizonyosság / jelzés-erősség** | közepes (a modell és a piac eltérése, mintaméret) | szűréshez |
| **Javasolt tét** | 1 egység (flat) / Kelly-tört szerint X | tétkezelés |
| **Indoklás: a fő tényezők** és hozzájárulásuk | „Forma +6 pp, kiesés elleni motiváció (vendég) −3 pp, 2 kulcsjátékos hiányzik (vendég) +4 pp” | megmagyarázhatóság |
| **Figyelmeztetések** | „A sérültlista 20 órás”, „Kevés H2H-adat”, „Az odds 30 órás” | adatminőség |
| Modellverzió | `elo-poisson@0.3.1` | visszakövethetőség |

> **Tippmix-megjegyzés:** az API irodalistájában nincs benne a Szerencsejáték Zrt.
> (nem ellenőrzött, a tulajdonos ellenőrizze az `/odds/bookmakers` listában). Ezért az
> ajánlás a **minimális vállalható oddsot** adja meg, és a tulajdonos a Tippmix-oddsot
> ehhez hasonlítja. Opció: a Tippmix-oddsot kézzel rögzítheti az ajánlásnál, és az is
> belekerül a kiértékelésbe.

## 7. Fő folyamatok (user story-k)

1. **Reggeli átnézés.** *Mint tulajdonos, reggel megnyitom az appot, és látom a mai és
   holnapi ajánlásokat a ligáimra, indoklással, valószínűséggel, EV-vel, a minimális
   vállalható oddsszal és a legjobb irodával, hogy 5 perc alatt döntsek.* Elfogadási
   feltétel: a lista hívás nélkül, a DB-ből töltődik be, és minden tétel kiírja az
   adatai korát.
2. **Meccs részletei.** *Egy ajánlást megnyitva látom a feature-öket (forma, tabella,
   tét, sérültek, H2H), a modell- és a piaci valószínűséget, és az odds mozgását.*
3. **Fogadás rögzítése (opcionális).** *Jelölöm, hogy megtettem a tippet, milyen
   oddsszal (Tippmix) és téttel.* Ebből jön a „saját” ROI, külön a modell ROI-jától.
4. **Meccsnap utáni kiértékelés.** *A meccsek után automatikusan lefut az
   eredménybetöltés és a kiértékelés. Másnap a dashboardon látom a tegnapi ajánlások
   eredményét és a halmozott mutatókat.* Elfogadási feltétel: emberi beavatkozás nem kell.
   A halasztott vagy törölt meccs void.
5. **Ligák beállítása.** *Kiválasztom a ligákat. Az app megmutatja a becsült napi
   hívásköltséget, és figyelmeztet, ha a keret nem elég.*
6. **Stratégia-iteráció.** *Új modellverziót backtesztelek 2022–2024 adatain, és
   összevetem a jelenlegivel és a baseline-okkal. Ha jobb, élesítem. A régi verzió
   naplója megmarad.*
7. **Budget-figyelés.** *Látom a mai felhasznált és a maradék hívásokat, és azt, hogy
   melyik job mennyit fogyasztott.*
8. **Arbitrázs (másodlagos).** *Megnézem, van-e arbitrázs a ligáim friss
   odds-snapshotjaiban. Kérésre a teljes piacot is pásztázhatom, előre jelzett
   hívásköltséggel.*

## 8. Nem-célok (most)

- Több felhasználó, regisztráció, fizetős funkciók, nyilvános megosztás.
- **Automatikus fogadásleadás** bármely irodánál.
- Élő (in-play) odds és élő eredménykövetés, push értesítés (egy napi e-mail vagy
  értesítés később újranyitható).
- Más sportágak (kosárlabda, baseball: a régi kódban lévő URL-ek kivezethetők).
- Mobil-first UI (a cél: mobilon olvasható legyen).
- Gépi tanulási „fekete doboz” modell, amely nem ad indoklást. **Megmagyarázhatóság
  nélküli modell nem kerül élesbe.**
- Fizetős adatforrás. *Kivétel:* ha a szezon-hozzáférés mérése (ROADMAP 0.0)
  megerősíti, hogy a free csomag nem fedi le a jelenlegi szezont, ezt a nem-célt
  tudatosan újra kell nyitni (D1).

## 9. Sikermutatók

| Terület | Mutató | Cél / küszöb |
|---|---|---|
| **Kalibráció** | Brier-pontszám (1X2, multi-class) a piaci baseline-hoz képest | modell ≤ piac (legalább egyenlő), 200+ predikció után |
| | Kalibrációs görbe (10%-os vödrök) | a vödrök átlagos eltérése < 5 pp |
| **Érték** | **CLV**: az ajánláskori odds / záró-közeli odds − 1, átlag | > 0 (ez a legkorábban mérhető jel arra, hogy a modell talál value-t) |
| | ROI flat téttel | > 0, 300+ ajánlás után; addig csak tájékoztató (a variancia nagy) |
| | Találati arány | csak az implikált valószínűséggel összevetve értelmes; önmagában nem cél |
| **Baseline** | A saját modell vs. az API `/predictions` és vs. a piac | a saját modell Brierben és log-lossban jobb az API-predikciónál |
| **Budget** | Napi API-hívás | **≤ 100, sosem lépi túl**; a napi működés ≤ 60, a többi backfill vagy tartalék |
| | Hívás nélküli megnyitás | az app megnyitása és böngészése **0 külső hívás** |
| **Megbízhatóság** | Kiértékeletlen lezárt meccsek | 48 órával a meccs után: 0 |
| | Kihagyott kezdés előtti odds-snapshot | < 5% a beállított ligák meccseire |
| **Fejlesztés** | Élő hívás fejlesztés és teszt közben | 0 (mock mód) |
| | A tiszta logika (arbitrázs-, modell-, kiértékelő-mag) unit-tesztelt | igen |

## 10. Nyitott kérdések és döntési pontok (javaslattal)

| # | Kérdés | Javaslat | Hol dől el |
|---|---|---|---|
| **D1** | ~~Adatforrás~~ **ELDŐLT (2026-11-12, ADR-0002):** mérve, a Free csomag csak 2022–2024-et adja. **Free marad**, amíg a UI és az üzleti logika el nem készül; `CURRENT_SEASON = 2024`; élő hívás a napi 100-on belül szabad (lekérés/mentés tesztelése), a fejlesztés zöme mentett adatból megy. Az aktuális szezonhoz később Pro vagy vegyes ingyenes források — új ADR. | ADR-0002 |
| **D2** | Hosting — **ELDŐLT (2026-11-12)** | **Vercel Hobby** (5 perces függvényidő, 15 percenként futtatható Schedules (béta), ingyenes beépített Vercel Authentication). Indoklás: [`architecture.md` §3](architecture.md). | ADR |
| **D3** | Adatbázis | **Supabase Postgres (free)** — a tulajdonos máshol is ezt használja (ismert eszköz, admin felület, opcionális Auth). Figyelni: 500 MB tárhely (csak az elemzett piacokat tároljuk), 1 hét inaktivitás után szünetel (az ütemezett ingestion ezt elkerüli, addig kézi újraindítás), free-ben max. 2 aktív projekt/szervezet. Alternatíva: Neon (1 GB). Lásd [`architecture.md` §4](architecture.md). | ADR-0004 |
| **D4** | Hozzáférés-védelem | A platform beépített védelme (Vercel Authentication) **és** egy szerveroldali, egyfelhasználós session (jelszó-hash env-ben, httpOnly cookie) az API-ra. | ADR |
| **D5** | Frontend: CRA + MobX v5 marad, vagy migrálunk | **Fokozatos migrálás Vite-ra; a MobX marad** (v6-ra frissítve, amikor a tooling engedi). A Next.js-re váltás csak akkor, ha az API is ugyanabba a projektbe kerül. Lásd [`architecture.md` §8](architecture.md). | ADR |
| **D6** | Mely ligák (és hány) | Kezdésnek a meglévő 5 top liga (PL, La Liga, Serie A, Bundesliga, Ligue 1), utána bővítés a budget-mérés alapján. | Beállítás |
| **D7** | Tét-stratégia | **Flat 1 egység**, amíg nincs 300+ kiértékelt ajánlás. Utána legfeljebb **¼ Kelly**, felső korláttal. | strategy.md |
| **D8** | Tippmix-odds kezelése | Kézi rögzítés opcionálisan, plusz a „minimális vállalható odds” mező. Automatikus Tippmix-adatgyűjtés **nem** cél (ToS, scraping). | PRD |
| **D9** | Kiértékelés egysége | Minden predikciót értékelünk (kalibrációhoz), de a ROI-t csak az ajánlásokra és a ténylegesen megtett tippekre számoljuk, külön-külön. | strategy.md |
| **D10** | Értesítés (pl. reggeli e-mail) | Most nem-cél. A 4. fázis után újragondolandó. | PRD |

## 11. Domain-szótár

| Fogalom | Jelentés |
|---|---|
| **Odd (decimális)** | Kifizetési szorzó. Implikált valószínűség = `1/odd`. |
| **Margin (overround)** | `Σ 1/odd − 1` egy piac kimenetelein. Ez az iroda haszna. |
| **Fair valószínűség** | Margin-mentesített implikált valószínűség (pl. arányos normalizálással: `(1/odd_i) / Σ(1/odd)`). |
| **EV (várható érték)** | `p_modell × odd − 1`. Ha > 0, value bet. |
| **Value bet** | Olyan tipp, ahol a modell szerinti valószínűség nagyobb, mint az odds implikált valószínűsége. |
| **CLV (closing line value)** | Mennyivel jobb oddsot kaptunk a záró oddsnál: `odd_ajánláskor / odd_záró − 1`. Hosszú távon a pozitív CLV a legjobb korai jel. |
| **Záró-közeli odds** | Nálunk az utolsó snapshot a kezdés előtti ≤ 3 órából (az API 3 óránként frissít, ezért valódi záró odds nincs). |
| **Brier-pontszám** | A valószínűségi becslés négyzetes hibája. Kisebb a jobb. |
| **Log-loss** | `−log(p_bekövetkezett)` átlaga. Erősen bünteti a magabiztos tévedést. |
| **Kalibráció** | A „60%”-os tippek kb. 60%-ban jönnek-e be. |
| **ROI** | Profit / összes tét. |
| **Flat tét / Kelly** | Fix egység minden tippre / a bankroll `(p·odd − 1)/(odd − 1)` része (nálunk tört-Kelly). |
| **Snapshot** | Az oddsok (vagy a tabella) időbélyeges pillanatképe, amelyet nem írunk felül. |
| **Feature-pillanatkép** | A predikció pillanatában érvényes bemeneti értékek. Ezzel az utólagos elemzés reprodukálható. |
| **Modellverzió** | A predikciót adó logika azonosítója (szemver). Változás esetén új verzió jön, a régi napló marad. |
| **Backtest** | Egy modell futtatása múltbeli adatokon, csak az akkor elérhető információval (nincs „jövőbe látás”). |
| **Szezonszakasz** | A szezon fázisa (pl. eleje: 1–8. forduló, közepe, hajrá: utolsó 8 forduló), a motiváció és a tét modellezéséhez. |
| **Motiváció / tét** | Mi múlik a meccsen egy csapatnak: bajnoki cím, európai kupahely, kiesés, vagy semleges. |
| **Fogadástípus / piac** | Pl. `Vegeredmeny` (1X2), `GolokSzama` (Over/Under), `MindketCsapatGol` (BTTS). Lásd `frontend/src/core/constants/BetTypes.ts`. |
| **Arbitrázs-arány** | `Σ 1/odd_max` a kimeneteleken. Ha < 1, garantált profit; a profit% ≈ `1/arány − 1`. |
| **twoParams / threeParams / specialTwoParams** | 2 kimenetelű, 3 kimenetelű és gólvonal-paraméteres típuscsoportok az `ArbitrageStore`-ban. |
| **Hívás-budget** | A napi 100 API-hívás (UTC-nap) beosztása a jobok között. |
| **Coverage** | Ligánként az API szerint elérhető adattípusok (`/leagues` → `coverage`). |

## 12. Fejlesztési elvek (AI-agenttel közös munka)

- **Ellenőrizhetőség:** minden változás után `typecheck` és tesztek. UI-változásnál
  screenshot a futó appról. Backend-változásnál integrációs teszt mock API-val.
- **Hívás-tudatosság:** élő API-hívás csak szándékosan, a tulajdonos jóváhagyásával.
  Alapból mock vagy fixture adat. **Az API-kulcsokhoz agent nem nyúl.**
- **Tiszta mag, vékony héj:** a modell, a kiértékelés és az arbitrázs tiszta, tesztelt
  függvény (bemenet → kimenet, nincs I/O). Az I/O (API, DB) a szélén van.
- **Reprodukálhatóság:** minden predikció modellverzióval és feature-pillanatképpel
  mentődik. A régi predikciót tilos átírni.
- **Döntések nyoma:** nagyobb munka előtt terv (`docs/plans/<téma>.md`), döntés után ADR
  (`docs/adr/`, a ROADMAP 0.6 után). Javaslatot csak a tulajdonos fogad el.
- **Szeletek:** a [`ROADMAP.md`](ROADMAP.md) szerint, egyszerre egy szelet = egy commit.
- **Hatókör:** ami a 8. fejezet nem-céljai közé esik, azt az agent nem kezdi el, hanem jelzi.
