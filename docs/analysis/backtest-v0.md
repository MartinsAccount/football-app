# Backtest: `elo-poisson@0.1.0` vs. piaci baseline

> Generált fájl (`npm run backtest -w @football/db`), kézzel ne szerkeszd. Gépi változat: `data/backtest/backtest-v0.json`.

## Protokoll

- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás). Bemelegítés: 2022; értékelt szezonok: 2023, 2024 (3504 meccs).
- Walk-forward: kezdés szerinti sorrend, az Elo inkrementális, az azonos napi meccsek egymás eredményét nem látják. A paraméterek fixek (`DEFAULT_ELO_POISSON_PARAMS`), illesztés nincs → mindkét értékelt szezon out-of-sample.
- Baseline: piaci átlag nyitó (`Avg*`) és záró (`AvgC*`) odds, arányos marzs-levonással. LL = átlagos log-loss, Brier = többosztályos Brier (kisebb a jobb). Páros összevetés: csak a nyitó és záró oddsszal is rendelkező meccsek.
- Értéktipp: piaconként a legnagyobb EV-jű kimenet, ha `p · odds − 1 ≥ 5%`; flat 1 egység a Bet365 nyitó oddsán; CLV a Bet365 záróhoz (`odds / záró − 1`).
- Ismert torzítás: a „nyitó” odds a CSV-letöltés pillanatának oddsa (péntek/kedd), nem a valódi nyitó; a kezdési időpont napra kerekítve.

## Összegzés

- 1X2: a modell log-lossa 0,0397-del rosszabb a záró piacnál.
- Gólszám 2,5: a modell log-lossa 0,0152-del rosszabb a záró piacnál.
- Értéktippek: 1X2 2553 db, ROI -20,7%, CLV 1,09%; O/U 1528 db, ROI -12,4%, CLV -1,16%.
- Értelmezés: amíg a modell a záró piacnál rosszabbul jósol, a „value” jelzései főleg modellhibák; a v1 (ROADMAP 6.x/7.x) célja a piaci rés csökkentése, a piaci kombinálás (`w`) és az EV-küszöb hangolása CLV alapján.

## Eredmények

### Összesen

**1X2**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| Összes | 3504 | 0,9968 | 0,9598 | 0,9570 | 0,5951 | 0,5703 | 0,5684 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| Összes | 2553 | 18,6% | 29,1% | -528,45 | -20,7% ± 3,8% | 1,09% |

**Gólszám 2,5**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| Összes | 3504 | 0,6771 | 0,6654 | 0,6618 | 0,4841 | 0,4729 | 0,4694 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| Összes | 1528 | 39,5% | 50,4% | -189,51 | -12,4% ± 2,9% | -1,16% |

### Szezononként

**1X2**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| 2023/24 | 1752 | 0,9976 | 0,9556 | 0,9533 | 0,5960 | 0,5674 | 0,5661 |
| 2024/25 | 1752 | 0,9959 | 0,9640 | 0,9608 | 0,5942 | 0,5731 | 0,5707 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| 2023/24 | 1265 | 17,2% | 30,2% | -363,95 | -28,8% ± 5,1% | 1,37% |
| 2024/25 | 1288 | 20,0% | 28,1% | -164,50 | -12,8% ± 5,5% | 0,82% |

**Gólszám 2,5**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| 2023/24 | 1752 | 0,6733 | 0,6620 | 0,6585 | 0,4804 | 0,4695 | 0,4662 |
| 2024/25 | 1752 | 0,6808 | 0,6688 | 0,6652 | 0,4877 | 0,4762 | 0,4726 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| 2023/24 | 729 | 39,8% | 50,0% | -82,75 | -11,4% ± 4,2% | -1,29% |
| 2024/25 | 799 | 39,2% | 50,8% | -106,76 | -13,4% ± 4,0% | -1,04% |

### Ligánként

**1X2**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| Bundesliga | 612 | 1,0095 | 0,9685 | 0,9665 | 0,6043 | 0,5756 | 0,5744 |
| Premier League | 760 | 0,9753 | 0,9399 | 0,9337 | 0,5796 | 0,5560 | 0,5510 |
| Ligue 1 | 612 | 1,0130 | 0,9861 | 0,9846 | 0,6066 | 0,5881 | 0,5874 |
| Serie A | 760 | 1,0024 | 0,9600 | 0,9595 | 0,6000 | 0,5720 | 0,5721 |
| La Liga | 760 | 0,9892 | 0,9512 | 0,9480 | 0,5892 | 0,5641 | 0,5622 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| Bundesliga | 437 | 19,9% | 31,7% | -82,60 | -18,9% ± 10,1% | 0,88% |
| Premier League | 573 | 18,5% | 28,4% | -98,99 | -17,3% ± 8,1% | 1,36% |
| Ligue 1 | 447 | 20,8% | 28,6% | -46,92 | -10,5% ± 8,9% | 1,01% |
| Serie A | 552 | 17,0% | 28,0% | -150,35 | -27,2% ± 7,5% | 1,77% |
| La Liga | 544 | 17,3% | 29,2% | -149,59 | -27,5% ± 7,8% | 0,37% |

**Gólszám 2,5**

| Szegmens | n | LL modell | LL nyitó | LL záró | Brier modell | Brier nyitó | Brier záró |
|---|--:|--:|--:|--:|--:|--:|--:|
| Bundesliga | 612 | 0,6604 | 0,6446 | 0,6375 | 0,4676 | 0,4527 | 0,4463 |
| Premier League | 760 | 0,6691 | 0,6625 | 0,6613 | 0,4761 | 0,4701 | 0,4690 |
| Ligue 1 | 612 | 0,6867 | 0,6781 | 0,6741 | 0,4936 | 0,4853 | 0,4813 |
| Serie A | 760 | 0,6917 | 0,6804 | 0,6762 | 0,4986 | 0,4873 | 0,4832 |
| La Liga | 760 | 0,6761 | 0,6598 | 0,6578 | 0,4832 | 0,4673 | 0,4652 |

| Szegmens | tippek | találat | várt | profit (egység) | ROI | CLV |
|---|--:|--:|--:|--:|--:|--:|
| Bundesliga | 259 | 41,3% | 52,8% | -32,73 | -12,6% ± 7,0% | -0,25% |
| Premier League | 328 | 44,2% | 51,6% | -17,98 | -5,5% ± 6,2% | -1,09% |
| Ligue 1 | 243 | 40,7% | 50,5% | -27,18 | -11,2% ± 7,0% | -0,78% |
| Serie A | 298 | 37,6% | 50,9% | -49,70 | -16,7% ± 6,3% | -1,39% |
| La Liga | 400 | 35,0% | 47,4% | -61,92 | -15,5% ± 5,9% | -1,85% |

## Kalibráció (modell)

**1X2** (minden kimenet egy pont)

| Vödör | n | átlag p | gyakoriság |
|---|--:|--:|--:|
| 0%–10% | 47 | 8,6% | 6,4% |
| 10%–20% | 810 | 16,6% | 10,4% |
| 20%–30% | 4843 | 25,7% | 24,4% |
| 30%–40% | 1958 | 34,6% | 33,1% |
| 40%–50% | 1641 | 44,6% | 48,6% |
| 50%–60% | 796 | 54,4% | 60,3% |
| 60%–70% | 334 | 64,2% | 73,4% |
| 70%–80% | 77 | 73,9% | 76,6% |
| 80%–90% | 6 | 82,4% | 100,0% |

**Gólszám 2,5**

| Vödör | n | átlag p | gyakoriság |
|---|--:|--:|--:|
| 10%–20% | 2 | 19,5% | 0,0% |
| 20%–30% | 83 | 27,3% | 34,9% |
| 30%–40% | 975 | 36,3% | 35,8% |
| 40%–50% | 2444 | 45,4% | 45,9% |
| 50%–60% | 2444 | 54,6% | 54,1% |
| 60%–70% | 975 | 63,7% | 64,2% |
| 70%–80% | 83 | 72,7% | 65,1% |
| 80%–90% | 2 | 80,5% | 100,0% |
