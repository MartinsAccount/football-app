# Történeti adat 2022–2024 (S11)

Nyers, változatlan forrásfájlok; soha ne kérd le újra őket.

| Mappa            | Forrás                                                                | Tartalom                                                     | Hogyan                                              |
| ---------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `api-football/`  | API-Football v3 `/fixtures?league&season` (free plan, 2026-11-12)     | `fixtures-<liga>-<szezon>.json`, 15 fájl, 5341 meccs         | `npm run fetch:history -w @football/api-client`     |
| `football-data/` | football-data.co.uk `mmz4281/<yyyy>/<div>.csv` (ingyenes, 2026-11-12) | `<div>-<yyyy>.csv`: eredmény, nyitó/záró 1X2 és O/U 2.5 odds | kézi `curl -L` (nem API-Football, nem fogy a kvóta) |

Ligák: 39 Premier League (`E0`), 61 Ligue 1 (`F1`), 78 Bundesliga (`D1`), 135 Serie A (`I1`), 140 La Liga (`SP1`). Szezon: API
`2022` = CSV `2223`.

DB-be: `npm run import:history -w @football/db` (meccsek), utána `npm run import:odds-csv -w @football/db` (CSV-odds →
`odds_snapshot` opening_csv/closing_csv + `team_alias`; a párosítatlan sorok listája: `unmatched-csv.json`).
