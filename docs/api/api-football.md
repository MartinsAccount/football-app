# API-Football v3: referencia ehhez az apphoz

> **Státusz:** Élő referencia · **Ellenőrizve:** 2026-11-12 · **Tulajdonos:** Martin
>
> Ez a fájl az API-Football v3-nak csak azt a részét írja le, amire a football-appnak
> szüksége van: végpontok, kvóta, hívás-budget, és a jelenlegi kód hívásainak auditja.
> Minden állítás mellett ott a forrás. A **„nem ellenőrzött”** jelölésű állítást használat
> előtt egy (kvótát nem fogyasztó) `/status` hívással vagy a dashboardon ellenőrizni kell.

**Források és megbízhatóságuk**

| Jel | Forrás | Megjegyzés |
|---|---|---|
| **[DOC]** | Hivatalos OpenAPI spec, v3.9.3: <https://www.api-football.com/public/doc/openapi.yaml> (ezt jeleníti meg a <https://www.api-football.com/documentation-v3> oldal) | Az api-football.com Cloudflare-rel blokkolja az automatizált letöltést, ezért a **2025-11-02-i Wayback-mentést** olvastuk: <https://web.archive.org/web/20251102131202/https://www.api-football.com/public/doc/openapi.yaml>. A 2026-os változásokat ez nem mutatja. |
| **[PRICING]** | <https://www.api-football.com/pricing>, Wayback-mentés: 2026-03-14 | Csomagok és napi kvóták. |
| **[KÖZÖSSÉG]** | Más projektek 2026-os GitHub-issue-i, bennük szó szerint idézett API-hibaüzenetekkel | Ez nem hivatalos forrás. Több, egymástól független projekt ugyanazt a hibaszöveget idézi. |

---

## 1. Legfontosabb tények (TL;DR)

| # | Tény | Forrás | Hatás a tervre |
|---|---|---|---|
| 1 | **Free csomag: 100 hívás/nap**, minden végpont és minden bajnokság elérhető, de **„a Free csomagban korlátozott, mely szezonok érhetők el”**. | [PRICING] | A napi keret mindenre közös. Lásd a 6. fejezetet. |
| 2 | ⚠️ **2026 őszén a Free csomag csak a 2022–2024-es szezonokat engedi.** A szó szerinti hiba: `"Free plans do not have access to this season, try from 2022 to 2024."` (HTTP 200, az `errors.plan` mezőben). | [KÖZÖSSÉG]: [MatrixLabSports #3](https://github.com/MatrixLabSports/MATRIX-LAB/issues/3) (2026-11-08), [youssef20031 PR #60](https://github.com/youssef20031/ACL_M3/pull/60) (2026-11-01), [nimeshjm #58](https://github.com/nimeshjm/fantasy-football/issues/58) (2026-09-18), [Jessedrt PR #40](https://github.com/Jessedrt/slippilot-ai/pull/40) (2026-09-22) | **Blokkoló kockázat.** A 2026/27-es szezon (`season=2026`) nem érhető el, és valószínűleg a 2025 sem. A tulajdonos memóriajegyzete szerint a `CURRENT_SEASON = 2025` a dashboard alapján elérhető volt. Ez **ellentmondás, és mérni kell** (ROADMAP 0.0). Ha igaz, a free csomagból **nem jön sem a közelgő meccsek listája, sem az oddsuk**: a fő funkció adatforrás nélkül marad. Lásd a 7. fejezetet. |
| 3 | A **pre-match odds a meccs előtt 1–14 nappal** érhető el, és **csak 7 napig őrzik meg** (az elérhetőség ligánként, szezononként, irodánként eltér). | [DOC] `/odds` | Odds-historyt **csak a saját snapshotjaink** adnak. Múltbeli oddsot az API-ból nem lehet visszatölteni, erre külső CSV kell (7.3). |
| 4 | Az `/odds` lapozott, **oldalanként 10 meccs**. | [DOC] `/odds` | A mostani kód csak az 1. oldalt kéri le, ezért meccsek hiányoznak (lásd 8. fejezet). |
| 5 | A `/fixtures?ids=` **egy hívásban legfeljebb 20 meccset** ad vissza, eseményekkel, felállással, statisztikával és játékosadatokkal együtt. Az `/injuries?ids=` szintén max. 20 meccset fogad. | [DOC] changelog 3.9.2 / 3.9.3 | Ez az eredmények és a sérültek kötegelt lekérésének a kulcsa. |
| 6 | A `/status` hívás **nem számít bele a napi kvótába**, és visszaadja a mai felhasználást (`requests.current`, `requests.limit_day`). | [DOC] Authentication | A budget-számláló ezzel egyeztethető. |
| 7 | A RapidAPI-s és az API-Sports dashboardos fiók **különálló**: más az URL, és más a kulcs. | [DOC] | Egy hostot kell választani. A kód most a kettőt keveri (8. fejezet). |
| 8 | Per-perces limit: a válaszheaderek mutatják. A Free csomagra **10 hívás/perc** szerepel harmadik féltől származó, illetve keresési kivonatokban (nem ellenőrzött). Túlzott terhelésnél a tűzfal **előzetes figyelmeztetés nélkül, ideiglenesen vagy véglegesen tilthat**. | [DOC] Rate Limiting Policy | Az ingestion legfeljebb kb. 1 hívást indítson 6–7 másodpercenként. Burst nem lehet. |
| 9 | Ha elfogy a kvóta, az API **nem számláz, hanem hibát ad vissza**. | [PRICING] | A hívó kódnak kezelnie kell a hibát (5. fejezet). |
| 10 | A napi kvóta **00:00 UTC-kor nullázódik**, a fel nem használt hívások elvesznek. | Nem ellenőrzött: keresési kivonat a vendor egyik blogcikkéből, az oldal blokkolt. A projekt-memória is ezt rögzíti. | A budget-számláló napja UTC-nap legyen. |

---

## 2. Hozzáférés, hostok, headerek

| | API-Sports (közvetlen) | RapidAPI |
|---|---|---|
| Base URL | `https://v3.football.api-sports.io/` | `https://api-football-v1.p.rapidapi.com/v3/` |
| Kulcs-header | `x-apisports-key: <KEY>`. A doksi példái `x-rapidapi-key` + `x-rapidapi-host: v3.football.api-sports.io` párt is használnak; mindhárom header engedélyezett. | `x-rapidapi-key: <KEY>`, `x-rapidapi-host: api-football-v1.p.rapidapi.com` |
| Fogyasztás követése | Dashboard + `/status` (kvótát nem fogyaszt) | RapidAPI developer dashboard |
| Kvóta-headerek | `x-ratelimit-requests-limit` / `-remaining` (napi), `X-RateLimit-Limit` / `-Remaining` (percenkénti) | `x-ratelimit-requests-limit` / `-remaining` (a csomag szerinti keret), `X-RapidAPI-Proxy-Response` |
| Free csomag | 100/nap [PRICING] | A RapidAPI-s árazási oldal nem töltődött be (JS). **Nem ellenőrzött.** |

További szabályok [DOC]:

- **Csak GET**, és csak a fenti három header engedélyezett. Ha egy keretrendszer extra headert tesz a kérésre, az API hibát ad. A böngészős CORS ezért is törékeny, ezért **a hívások a backendről menjenek**.
- A **logó- és képhívások** (`media.api-sports.io/...`) nem számítanak a kvótába, de saját sebességkorlátjuk van. Ezeket érdemes cache-elni.
- **A szezon mindig a kezdőév:** a 2025/26-os szezon `season=2025` [DOC] `/leagues/seasons`.

**Javaslat:** a közvetlen API-Sports hostot használjuk `x-apisports-key` headerrel. A tulajdonos dashboardos fiókja is ez, és a `/status` itt működik. A kulcs csak a backend környezeti változójában (`API_FOOTBALL_KEY`) legyen.

---

## 3. Válaszformátum, lapozás, hibák

Minden válasz azonos burokban érkezik [DOC]:

```json
{ "get": "odds", "parameters": {"league": "39", "season": "2025"}, "errors": [],
  "results": 10, "paging": {"current": 1, "total": 3}, "response": [ ... ] }
```

| Téma | Szabály |
|---|---|
| **Lapozás** | Csak ott van, ahol a doksi kimondja: `/odds` 10/oldal, `/odds/mapping` 100/oldal, `/players` 20/oldal. A `/fixtures` **nem lapoz**: ha `page` paramétert kap, ezt a hibát adja: `"The Page field do not exist."` ([Jessedrt PR #40](https://github.com/Jessedrt/slippilot-ai/pull/40), közösségi forrás). A `paging.total` alapján kell továbblapozni, és **minden oldal külön hívásnak számít**. |
| **Hiba = HTTP 200 + `errors`** | A logikai hibák (rossz paraméter, csomag- vagy szezonkorlát, kvóta) jellemzően **HTTP 200**-zal jönnek, `results: 0`, a szöveg pedig az `errors` mezőben van. Az `errors` lehet **tömb vagy objektum** (pl. `{"plan": "..."}`, `{"requests": "..."}`, `{"token": "..."}`). Az `errors.plan` esetét a közösségi források igazolják. A `requests`/`token` kulcsnevek **nem ellenőrzöttek**. **Szabály: a `response.ok` nem elég; ha az `errors` nem üres, a hívás sikertelen.** |
| **Kvóta-kimerülés** | Az API hibaüzenetet ad, nem számláz [PRICING]. A pontos payload nem ellenőrzött. A `x-ratelimit-requests-remaining` headerből és a `/status`-ból előre látható. |
| **Hiányzó kötelező paraméter** | Például `"The Season field is required."` ([nimeshjm #58](https://github.com/nimeshjm/fantasy-football/issues/58)). |
| **Percenkénti túllépés** | Tűzfal-tiltás is lehet [DOC]. Nem szabad párhuzamosan hívni. |

---

## 4. Végpontok, amelyekre az appnak szüksége van

A „Frissítés” és az „Ajánlott hívás” oszlop a doksi saját szövegét adja vissza [DOC]. A doksi szerint ezek „tájékoztató jellegűek, versenysorozatonként eltérhetnek”. Az „Appbeli cél” oszlop a mi felhasználásunk.

### 4.1 Törzsadatok (ritkán változnak, erősen cache-elhetők)

| Végpont | Appbeli cél | Fő paraméterek | Frissítés / ajánlott hívás | Megjegyzés |
|---|---|---|---|---|
| `/status` | Kvóta-egyeztetés | — | — | **Nem fogyaszt kvótát.** |
| `/timezone` | Nem kell (UTC-ben tárolunk) | — | nem frissül | — |
| `/leagues` | Liga-katalógus a beállításokhoz, **`coverage` flagek** | `id`, `season`, `country`, `current`, `type`, `search`, `team`, `last` | naponta többször / 1×óra | A `coverage` megmondja, mi érhető el az adott ligában (`fixtures.events/lineups/statistics_fixtures/statistics_players`, `standings`, `players`, `injuries`, `predictions`, `odds`). **Csak a hívás pillanatára igaz**: a még el nem indult szezonban minden `false`. Szezononként változhat, és a `true` sem garantál 100%-os lefedettséget. Nálunk elég **hetente egyszer, ligánként** (`/leagues?id=X&season=S`), vagy egyetlen hívás az összes ligára. |
| `/leagues/seasons` | Szezonlista | — | új liga esetén / 1×nap | Nálunk évente egyszer elég. |
| `/teams` | Csapat-törzsadat | `league`+`season`, `id`, `search` | hetente többször / 1×nap | **Szezononként, ligánként 1 hívás.** A csapat-id ligák és szezonok között is egyedi. |
| `/fixtures/rounds` | Fordulók és dátumaik | `league`*, `season`*, `current`, `dates` | naponta / 1×nap | A `dates=true` (3.9.3) a fordulók dátumait is visszaadja, ebből tervezhetők a snapshot-időpontok. |
| `/odds/bookmakers` | Iroda-katalógus | `id`, `search` | hetente többször | Havonta 1 hívás elég. |
| `/odds/bets` | Piac-katalógus (bet id ↔ név) | `id`, `search` | hetente többször | Havonta 1 hívás elég. A `bet=<id>` szűrő **nem csökkenti a hívásszámot**, csak a payload méretét. |

### 4.2 Meccsek és eredmények

| Végpont | Appbeli cél | Fő paraméterek | Frissítés / ajánlott hívás | Megjegyzés |
|---|---|---|---|---|
| `/fixtures` | Közelgő meccsek, státusz, végeredmény, félidő | `id`, **`ids` (max. 20, kötőjellel elválasztva)**, `date`, `league`+`season`, `from`/`to`, `team`, `next`/`last` (max. 2 jegy), `round`, **`status` (több is, pl. `NS-PST-FT`)**, `timezone` | 15 mp-enként / élő meccsnél 1×perc, egyébként 1×nap | **Nem lapoz.** Egy hívás egy liga teljes szezonját visszaadja (`league`+`season`). Az **`ids`-szel lekért** meccsekben benne vannak az események, felállások, statisztikák és játékosadatok is, ezért ez a meccs utáni feldolgozás legolcsóbb módja. Ha egy versenysorozatban nincs élő eredmény, a státusz `NS` marad, és a végeredmény **akár 48 órás késéssel** érkezik. |
| `/fixtures/headtohead` | H2H | `h2h`* (`teamA-teamB`), `last`, `league`, `season`, `status`, `from`/`to` | 15 mp / 1×nap | **Javaslat: a saját meccs-DB-ből számoljuk**, 0 hívással (backfill után). API-hívás csak akkor kell, ha a pár régebbi, mint a backfill-ablak. |
| `/fixtures/statistics` | Lövések, kapura lövések, szöglet, labdabirtoklás | `fixture`*, `team`, `half` (félidős adatok csak 2024-től) | 1×perc / 1×nap | **Ne meccsenként hívjuk**, hanem a `fixtures?ids=` kötegben. |
| `/fixtures/events` | Gólpercek, piros lapok | `fixture`*, `team`, `type` | 15 mp / 1×nap | A `fixtures?ids=` kötegben jön. A VAR-események 2020/21-től elérhetők. |
| `/fixtures/lineups` | Kezdőcsapat (rotáció, kulcsjátékos hiánya) | `fixture`* | 15 perc / 1×nap | **20–40 perccel kezdés előtt** érhető el, ha a ligának van ilyen lefedettsége. Az ajánlás ennél korábban készül, ezért v1-ben nem használjuk. |
| `/fixtures/players` | Játékos-értékelések meccsenként | `fixture`*, `team` | 1×perc / 1×nap | Csak később kell, a kulcsjátékos-modellhez. |

**Fixture státuszkódok** [DOC]: `TBD`, `NS` (ütemezett) · `1H`, `HT`, `2H`, `ET`, `BT`, `P`, `SUSP`, `INT`, `LIVE` (folyamatban) · `FT`, `AET`, `PEN` (befejezett) · `PST` (halasztott), `CANC` (törölt), `ABD` (félbeszakadt) · `AWD`, `WO` (nem játszották le, technikai döntés).
Nálunk a **„lezárt” meccs = `FT`, `AET` vagy `PEN`**, és az ajánlás kiértékelésénél **a rendes játékidő eredménye** számít (a `score.fulltime`, nem a hosszabbítás). A `PST`, `CANC` és `ABD` státuszú meccsre adott ajánlás **void**, nem kerül kiértékelésre. A `TBD`, `PST` és `CANC` státuszt az API naponta újraellenőrzi.

### 4.3 Elemzési bemenetek

| Végpont | Appbeli cél | Fő paraméterek | Frissítés / ajánlott hívás | Megjegyzés |
|---|---|---|---|---|
| `/standings` | Tabellahely, pontkülönbségek (motiváció) | `league`+`season`*, `team` | óránként / 1×nap, ha nincs folyamatban lévő meccs | Ligánként egyetlen hívás. **Csak az aktuális tabellát adja vissza, korábbi állapotot nem.** Az idősoros tabellát mi építjük (snapshot), vagy a meccsekből számoljuk újra. |
| `/teams/statistics` | Forma, gólátlagok, kapott nélküli meccsek, gólpercek, Over/Under | `league`*, `season`*, `team`*, **`date`** (a szezon elejétől a megadott napig) | naponta kétszer / 1×nap meccsnapon, egyébként 1×hét | Csapatonként 1 hívás, ez drága: 20 csapat = 20 hívás. **Javaslat: a saját DB-ből számoljuk.** A `date` paraméter a backtesthez értékes lenne (pont-időbeli statisztika), de hívásigényes. |
| `/injuries` | Sérült / eltiltott / bizonytalan játékosok | `fixture`, **`ids` (max. 20 meccs)**, `league`+`season`, `team`+`season`, `date` | 4 óránként / 1×nap | Típusok: `Missing Fixture`, `Questionable`. Adat 2021 áprilisától van. A **`ids`** paraméterrel egy meccsnap sérültjei 1–3 hívásból lekérhetők. A `date` önmagában (liga nélkül) nem ellenőrzött. |
| `/sidelined` | Egy játékos hosszabb távú kiesés-története | `player` / `players` (max. 20), `coach` / `coachs` | hetente többször / 1×nap | v1-ben nem kell. Később a „kulcsjátékos tartósan kiesett” jelhez lehet hasznos. |
| `/players/squads` | Aktuális keret | `team` / `player` | hetente többször / 1×hét | v1-ben nem kell. |
| `/players` | Játékos-statisztika (rating, gól) | `team`/`league`+`season`, `id`, `page` (20/oldal) | hetente többször / 1×nap | Drága, mert lapoz. Csak a kulcsjátékos-súlyozáshoz kell (későbbi fázis). |
| `/predictions` | **Külső baseline-modell** | `fixture`* | óránként / 1×nap | Lásd 4.4. Meccsenként 1 hívás. |

### 4.4 `/predictions`: mit ad, és hogyan használjuk

A doksi szerint [DOC] a predikció **Poisson-eloszlással, csapatstatisztikák összevetésével, az utolsó meccsekből és a játékosadatokból** készül, és **nem használ bukmékeri oddsot**. A válasz egy meccsre:

| Mező | Tartalom |
|---|---|
| `predictions.winner` | Az esélyes csapat id-je, plusz egy megjegyzés (pl. „Win or draw”) |
| `predictions.win_or_draw` | bool |
| `predictions.under_over`, `goals.home/away` | Gólvonal-ajánlás, pl. `"-3.5"` (= legfeljebb 3 gól) |
| `predictions.advice` | Szöveges tipp, pl. „Combo Double chance : X or draw and -3.5 goals” |
| `predictions.percent` | **1X2 százalékok** (`home`/`draw`/`away`), pl. 45% / 45% / 10% |
| `comparison` | `form`, `att`, `def`, `poisson_distribution`, `h2h`, `goals`, `total`: hazai és vendég százalékok |
| `teams.home/away.last_5` és `.league` | Az utolsó 5 meccs formája, gólátlagok, legnagyobb győzelem/vereség, kapott nélküli és gól nélküli meccsek |
| `h2h` | A korábbi egymás elleni meccsek listája |

**Felhasználás (javaslat):**

1. **Benchmark-modell a learning loopban.** A `percent` mezőt 1X2-valószínűségként naplózzuk, és ugyanúgy kiértékeljük (Brier, kalibráció, ROI), mint a saját modellt. A saját modellnek ezt kell megvernie.
2. **Olcsó feature-forrás.** Egy hívás visszaadja a formát, a gólátlagokat és a H2H-t is, tehát egy meccsre kiválthatja a `/teams/statistics` ×2 és a `/fixtures/headtohead` hívást. Ez akkor éri meg, ha a meccsek száma kicsi.
3. **Költség:** meccsenként 1 hívás. Hétvégente 5 ligával kb. 45 hívás, ez nem fér bele a napi budgetbe. **Csak a jelöltekre hívjuk** (azokra a meccsekre, ahol a saját modell már value-t lát), vagy egy kiválasztott ligára.
4. **Korlát:** a `percent` durván kvantált (5%-os lépcsők), és gólpiacra nem ad valószínűséget, csak vonalat. Önmagában nem alkalmas EV-számításra.

### 4.5 Odds

| Végpont | Appbeli cél | Fő paraméterek | Frissítés / ajánlott hívás | Megjegyzés |
|---|---|---|---|---|
| `/odds` | **Pre-match odds snapshot** (ajánlás, arbitrázs, odds-history) | `fixture`, `league`+`season`, `date`, `bookmaker`, `bet`, `page`, `timezone` | **3 óránként** / 1 hívás 3 óránként | **10 meccs/oldal.** Az odds **1–14 nappal a meccs előtt** érhető el, és **7 napig őrzik**. A válaszban `update` időbélyeg van, ezt is tároljuk. Struktúra: `response[].bookmakers[].bets[].values[] = {value, odd}`, az `odd` **string**. |
| `/odds/mapping` | Mely meccsekhez van odds | `page` (100/oldal) | naponta / 1×nap | Az arbitrázsmodul liga-felderítéséhez kell. A beállításokban kiválasztott ligáknál **nem kell**, mert ott a liga ismert. |
| `/odds/live`, `/odds/live/bets` | Élő odds | — | — | **Nem-cél** (PRD). |

**Az odds frissességéből következő szabályok:**

- 3 óránként 1-nél gyakoribb snapshot ugyanarra a meccsre felesleges, mert az adat nem frissül gyakrabban.
- A „záró odds” (closing line) közelítése: **az utolsó snapshot, amely a kezdés előtt 3 órán belül készül.** Ez nem valódi záró odds; a kezdés előtti utolsó 0–3 óra mozgása hiányzik belőle. A CLV-mérésnél ezt jelezni kell (lásd `docs/analysis/strategy.md`).
- **7 nap után az odds eltűnik az API-ból.** Ha egy snapshotot nem mentünk el, az utólag nem pótolható.

---

## 5. Kötelező kliens-viselkedés (a backend proxyra)

| Szabály | Miért |
|---|---|
| Minden hívás **egyetlen backend-kliensen** megy át, amely naplóz (`api_call_log`: végpont, paraméterek, státusz, `errors`, a maradék kvóta a headerből, időtartam, a hívást kiváltó job). | Budget-láthatóság és auditálhatóság. |
| **Budget-őr hívás előtt:** ha `mai_hívások + tervezett > napi_limit − tartalék` (tartalék kb. 5), a job nem indul, vagy a kevésbé fontos feladat elhalasztódik. | Kemény 100-as plafon. |
| **Szerializált hívások**, legalább 6–7 mp szünettel (kb. ≤ 9/perc). | Percenkénti limit és tűzfal. |
| Ha az `errors` nem üres, a hívás **sikertelen**. Ha `errors.plan` jön, a job **nem próbálkozik újra** (ugyanaz a hiba jönne, és a hívás is fogy). | HTTP 200 + hiba. |
| **Idempotens mentés** (upsert a fixture-, liga- és csapat-id-re; snapshot-kulcs: `fixture_id`, `captured_at`). | Ha egy job újrafut, nem keletkezhet duplikátum. |
| A **dev/test környezet 0 élő hívással** fut: rögzített fixture-válaszokból (ROADMAP 0.5). | A fejlesztés nem fogyaszthatja a kvótát. |
| A `/status` hívást minden job elején és végén meghívjuk, és egyeztetjük a saját számlálónkkal. | Kvótát nem fogyaszt, és jelzi, ha a számlálónk eltér a valóságtól. |

---

## 6. Hívás-budget

### 6.1 Feltevések

- **N beállított liga** (alapeset: N = 5 top liga, ligánként fordulónként kb. 10 meccs, hetente 1, néha 2 forduló).
- A szezon elérhető a csomagban. **A Free csomagnál ez jelenleg kétséges, lásd 1. fejezet, 2. sor.**
- A forma, a H2H és a gólátlag a **saját DB-ből** számolódik (backfill után), tehát erre nem megy hívás.
- A `/predictions` opcionális, csak a jelöltekre hívjuk.

### 6.2 Becslés ligánként és fordulónként

| Feladat | Végpont | Hívás / liga / forduló | Mikor |
|---|---|---|---|
| Meccslista frissítése | `fixtures?league&season&from&to` | 1 | T−5…T−3 nap |
| Tabella-snapshot | `standings?league&season` | 1 | a forduló előtti napon |
| Korai odds-snapshot | `odds?league&season` (+`page`) | 1–2 (10 meccs/oldal) | T−48…T−24 óra |
| Késői odds-snapshot (≈ záró) | `odds?league&season&date=<meccsnap>` | 1 meccsnaponként (jellemzően 2–3) | a nap első kezdése előtt 3 órán belül |
| Sérültek | `injuries?ids=<≤20 meccs>` | 1 | T−24 óra (opcionálisan T−3 óra) |
| Eredmény + statisztika + események | `fixtures?ids=<≤20 meccs>` | 1 | a forduló után, +1 nap (a 48 órás késés miatt egy második körre is lehet szükség) |
| *(opcionális)* Predikció | `predictions?fixture` | 0–10 | T−24 óra |
| **Összesen (predikció nélkül)** | | **≈ 7–9** | |

**Közös, nem ligánkénti költségek:** `/leagues` heti 1 · `/odds/bookmakers` és `/odds/bets` havi 1–1 · `/teams` ligánként szezononként 1 · `/fixtures/rounds` ligánként hetente 1 (opcionális).

### 6.3 Napi kép N liga esetén

| N liga | Hívás / forduló (összesen) | Heti átlag (1,3 forduló/hét) | Napi átlag | Csúcsnap (péntek–szombat) | Maradék backfillre (átlagnap) |
|---|---|---|---|---|---|
| 3 | ~25 | ~33 | ~5 | ~15 | ~90 |
| 5 | ~42 | ~55 | ~8 | ~25 | ~85 |
| 10 | ~85 | ~110 | ~16 | ~50 | ~75 |
| 15 | ~125 | ~165 | ~24 | ~75 ⚠️ | ~65 |

Következtetés: **a napi működés kb. 10 ligáig kényelmesen belefér**, ha a forma, a H2H és a csapatstatisztika saját adatból számolódik. A szűk keresztmetszet a **csúcsnap**: péntek–szombat a késői odds-snapshotok és a sérültek miatt. Ezért a job-ütemezőnek **prioritásos sor** kell (lásd architecture.md), és a késői snapshotnak elsőbbsége van a backfillel szemben.

### 6.4 Történeti backfill (a modellhez és a backtesthez)

| Adat | Hívás | Egy liga, egy szezon |
|---|---|---|
| Teljes szezon meccsei és végeredményei | `fixtures?league&season` | **1** |
| Statisztika, események, felállás meccsenként | `fixtures?ids=` 20-as kötegekben | 380 meccs / 20 = **19** |
| Csapatok | `teams?league&season` | 1 |
| Tabella-idősor | — (a meccsekből számoljuk) | 0 |
| **Történeti odds** | **Az API-ból nem lehet** (7 napos megőrzés) | külső CSV, lásd 7.3 |

5 liga × 3 szezon (2022–2024) csak eredményekkel = **15 hívás**. Statisztikával együtt kb. **300 hívás**, ez napi kb. 60-as kerettel **5–6 nap** alatt végigfut.

### 6.5 Takarékossági stratégiák (prioritási sorrend)

1. **Számoljunk a saját DB-ből** (forma, H2H, gólátlag, tabella-idősor). Ez a legnagyobb megtakarítás.
2. **Kötegelés:** `fixtures?ids=` és `injuries?ids=`, max. 20 meccs/hívás.
3. **Liga + szezon lekérés** meccsenkénti hívás helyett (`fixtures`, `odds`).
4. **Csak a beállított ligák.** Az `/odds/mapping` teljes bejárása (mostani arbitrázs) csak az arbitrázsmodulnak kell, ott is csak opcionálisan, napi max. 1×.
5. **TTL-cache a végpont frissítési ritmusához igazítva** (törzsadat: hét/hónap, standings: nap, odds: ≥ 3 óra).
6. **A backfill tartalékkeretből fut**, több napra elosztva, és a napi működés mindig megelőzi.
7. **A `/status` ingyenes.** A kvóta-ellenőrzésre ezt használjuk, ne adathívást.

> A korábbi, csak arbitrázsra szóló hívásterv: `docs/plans/api-optimization.md` (elavult, ide olvadt be).

---

## 7. Free-csomag kockázatok és alternatív adatforrások

### 7.1 Szezon-hozzáférés: mérendő (ROADMAP 0.0)

Egyetlen hívással eldönthető: `GET /fixtures?league=39&season=2026&next=1`. A kérdés: üres-e az `errors`. Szükség esetén ugyanez `season=2025`-tel is. Előtte és utána egy `/status` hívás, amely ingyenes. **Ezt a tulajdonos futtassa le, vagy hagyja jóvá.** A dokumentáció írásakor nem futott élő hívás.

### 7.2 Ha a jelenlegi szezon nem érhető el a Free csomagban (döntési pont, ADR)

| Opció | Előny | Hátrány |
|---|---|---|
| **A. API-Football Pro: 19 USD/hó, 7 500 hívás/nap** [PRICING] | Minden szezon elérhető. A budget-gond megszűnik: H2H, `/teams/statistics`, `/predictions` minden meccsre. A meglévő kód és doksi változtatás nélkül használható. | Havi költség. A tulajdonos eddigi döntése az volt, hogy a free csomag marad. |
| **B. Free API-Football csak a 2022–2024-es backfillhez** + külön forrás a jelenhez | A modell tanítása és a backtest ingyenes. | A jelenhez kell egy másik forrás (C vagy D), ami két adatmodellt és csapatnév-mapping-et jelent. |
| **C. football-data.org Free:** 12 versenysorozat, 10 hívás/perc, meccsek és tabella, az eredmények késleltetve, **odds nélkül** (<https://www.football-data.org/pricing>) | Ingyenes, stabil, és a top ligákat lefedi. | Nincs benne odds, sérült, felállás. Odds-forrás külön kell. |
| **D. The Odds API Starter:** 500 kredit/hó, „most bookmakers” (<https://the-odds-api.com/>) | Ingyenes, jelenidejű pre-match odds. | Kevés kredit (kb. 16/nap). A kreditszámítás (piac × régió) és a történeti odds a free csomagban **ellentmondásos, nem ellenőrzött**. |

**Javaslat:** először mérjünk (7.1). Ha a jelenlegi szezon nem érhető el, a fő funkció **egyszerűbb és megbízhatóbb az A opcióval**, a tulajdonos döntése szerint akár csak a futballszezon hónapjaira. Ha a tulajdonos ragaszkodik a 0 Ft-hoz, akkor **B + C + D**, de ez architektúra-szinten egy adatforrás-absztrakciós réteget igényel (`provider`). Ezt a döntést a ROADMAP 0. fázisában meg kell hozni, mert minden későbbi fázis ettől függ.

### 7.3 Történeti odds a backtesthez: football-data.co.uk

Az API-ból történeti odds nem tölthető vissza, mert csak 7 napig őrzi. Ingyenes alternatíva a **football-data.co.uk** CSV-fájljai (<https://www.football-data.co.uk/notes.txt>). Ezekben benne vannak az eredmények, a meccsstatisztikák (lövés, kapura lövés, szöglet, lap) és számos iroda **nyitó- és záró-oddsa** (pl. `B365H/D/A`, `PSH`, `MaxH`, `AvgH`, a záró oddsnál egy plusz `C` betűvel: `B365CH`), valamint O/U 2.5 és ázsiai hendikep. A pontos liga- és szezonlefedettséget a notes.txt nem sorolja fel, ezért ez **nem ellenőrzött**. **Javaslat:** a backtest odds-forrása ez legyen. A csapatnév ↔ API csapat-id leképezéshez egy kis mapping-tábla kell.

---

## 8. A mostani kód hívásainak auditja (`frontend/src/services/ApiURLs.ts`)

| Konstans | Végpont | Ki hívja | Probléma | Teendő |
|---|---|---|---|---|
| `urls.football` | RapidAPI base (`api-football-v1.p.rapidapi.com/v3`) | minden hívás | A tulajdonos fiókja (memóriajegyzet) API-Sports dashboardos; a RapidAPI külön fiók és külön kulcs [DOC]. | Egy host: `v3.football.api-sports.io`, a backendben. |
| — | — | `FetchService3.ts` (`ArbitrageService`, `FixtureService`, `OddsService`) | **`x-rapidapi-host: v3.football.api-sports.io` headert küld a RapidAPI URL-re**, ez host-eltérés. Ezen felül a kulcs a forráskódban van. | Megszűnik, amikor a hívások a backend proxyra kerülnek (ROADMAP 1. fázis). |
| `GET_LEAGUE_ODDS` | `/odds?league&season` | `ArbitrageStore.getHighestOdds` | **Nincs `page`**, így ligánként csak az első 10 meccs jön le. Az arbitrázs a többi meccset nem látja. | Lapozás a `paging.total` szerint. |
| `GET_UNIBET_ODDS` | `/odds?league&season&bookmaker=16` | `OddsStore.saveOdds` | Ugyanez: csak az 1. oldal (10 meccs) mentődik. | Lapozás. |
| `AVAILABLE_FIXTURES_FOR_ODDS` | `/odds/mapping?page` | `ArbitrageStore.searchAllLeagueIds` | Korrekt, de az összes oldal bejárása sok hívás. A doksi szerint naponta frissül, 1×/nap ajánlott. | Csak az arbitrázsmodulban, napi max. 1×, backend-cache-ből. |
| `GET_ALL_BOOKMAKERS_ODDS` | `/odds?season&bet=1&fixture` | `OddsService` | A `season` felesleges a `fixture` mellett. A `leaguesId` paraméter nincs használva. | Tisztítás. |
| `GET_CURRENT_SEASON_FIXTURES` | `/fixtures?season&league` | `FixtureStore.Init` (most nincs bekötve) | Korrekt. 5 hívás, ha lefut. | Backend-ingestionbe. |
| `GET_TODAY_FIXTURES` | `/fixtures?date` | `FixtureService.GetTodayFixtures` | **Bedrótozott `'2021-10-06'`.** | Törlés vagy paraméterezés. |
| `GET_UEFA_CHAMPIONS_LEAGUE_FIXTURES`, `GET_UEFA_EUROPA_LEAGUE_FIXTURES` | `/fixtures?league&from&to` / `date` | `FixtureService` | **Bedrótozott 2021-es dátumok.** | Törlés; a beállított ligák váltják ki. |
| `GET_CURRENT_ROUND` + `GET_CURRENT_ROUND_FIXTURES` | `/fixtures/rounds?current=true`, `/fixtures?round` | `FixtureService.GetCurrentRoundFixtures` | **Hibás:** a teljes válasz-objektumot adja át `round`-ként (a `response[0]` kellene), és a `round` nincs URL-kódolva (`"Regular Season - 12"`). | Javítás vagy kivezetés. |
| `GET_LEAGUES` | `/leagues` | `FixtureService.GetLeagues` | A `country` paramétert nem használja. Paraméter nélkül az összes liga jön, ez nagy payload. | `id`/`season` szűrés. |
| `GET_FIXTURE_STATISTICS` | `/fixtures/statistics?fixture` | `FixtureService` | Meccsenként 1 hívás. | `fixtures?ids=` köteg. |
| `GET_FIXTURE` | `/fixtures?id` | `ArbitrageStore` (modal) | Megnyitásonként 1 hívás. | DB-ből szolgáljuk ki. |
| `CURRENT_SEASON = 2025` | — | minden szezonos hívás | 2026 novemberében a futó európai szezon a **2026** (2026/27). A Free csomag a közösségi források szerint csak 2022–2024-et engedi. | Mérés (7.1), utána a szezon a liga beállításából jön (`leagues.current`), nem konstansból. |
| `Leagues.ts` | — | — | Az id-k (`39`, `78`, `61`, `140`, `135`, `2`, `3`) a közismert API-Football id-k. A `FIFA_World_Cup = 15` és a `World_Cup = 1` jelentése **nem ellenőrzött**. | A ligatörzs a DB-be kerül, `/leagues`-ből. |

A kosárlabda és baseball URL-ek nem tartoznak a projekt hatókörébe (PRD nem-cél).
