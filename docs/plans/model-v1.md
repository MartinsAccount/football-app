# Terv: modell v1 (ROADMAP 6.0–6.2b, I25–I26)

Autonóm munkamódban készült (jóváhagyás nélkül, CLAUDE.md); döntések: `docs/DECISIONS.md` (2026-11-16, I25).

## Modellek

- **M1 `elo-logit@1.0.0`** (I25, `packages/core/src/model/ordinalLogit.ts`): kumulatív logit a meccs előtti Elo-különbségen,
  `x = (R_h + H − R_a) / 400`; `P(vendég) = σ(c1 − βx)`, `P(vendég ∪ döntetlen) = σ(c2 − βx)`. Paraméterek: `β, c1 < c2` (3 db).
  Az Elo a meglévő `model/elo.ts` (`DEFAULT_ELO_PARAMS`, K = 20, H = 60, szezonvisszahúzás 1/3) – változatlan, hogy a v0-val
  ugyanazon az Elo-n mérjünk. Csak 1X2-t ad (gólpiac: M2).
- **M2 `elo-poisson@0.2.0`** (I26): Dixon–Coles ML-illesztés (támadó/védő erő, hazai előny, ρ, időbeli súly `exp(−ξ·t)`).

## Illesztés

- Maximum likelihood, Newton-lépés (numerikus Hesse a analitikus gradiensből) + visszalépő vonalkeresés, kezdőpont β = 1 és a
  tapasztalati gyakoriságokból számolt küszöbök. Véletlen nincs → determinisztikus (a „seed” csak a teszt szintetikus mintájához
  kell).
- Tanítóminta walk-forward: kezdés szerint léptetett Elo, minden meccsnél a frissítés ELŐTTI különbség; azonos kezdésű meccsek
  egymást nem látják (ugyanaz, mint a `runBacktest`).
- Elo-paraméterek (K, H) hangolása: most nincs; ha lesz, csak a 2022–2023-on, rácskereséssel (I26 vagy később).

## Backtest-protokoll

- Adat: football-data.co.uk CSV, top 5 liga, 2022/23–2024/25 (0 élő hívás).
- Tanítás: 2022 + 2023 szezon (2022 egyben Elo-bemelegítés). **Holdout: 2024 zárolt** – csak a végső összevetéshez, hangolásra nem
  (strategy.md §6). Minden kipróbált változat bekerül a riportba / DECISIONS-be.
- Mérőszám: 1X2 átlag log-loss + többosztályos Brier, páros minta (csak nyitó + záró átlag-oddsszal rendelkező meccsek), baseline:
  piaci nyitó / záró (`Avg*` / `AvgC*`, arányos marzs-levonás). Futtatás: `npm run backtest:elo-logit -w @football/db`.
- A teljes v1-riport (ROI, CLV, kalibráció, szegmensek) az I26-ban, `docs/analysis/backtests/<dátum>-model-v1.md`.

## Első eredmény (I25, 2026-11-16)

Illesztés 2022–2023 (n = 3578, 4 iteráció): β = 2,9951, c1 = −0,4813, c2 = 0,7116 (tanító LL 0,9972).

| Holdout 2024, 1X2 (páros n = 1752) | log-loss |  Brier |
| ---------------------------------- | -------: | -----: |
| `elo-logit@1.0.0` (M1)             |   0,9905 | 0,5906 |
| `elo-poisson@0.1.0` (v0)           |   0,9959 | 0,5942 |
| piac nyitó                         |   0,9640 | 0,5731 |
| piac záró                          |   0,9608 | 0,5707 |

M1 jobb a v0-nál (−0,0054 LL), de a piac mögött marad (+0,030 LL a zárónál) → önmagában nem élesíthető; a 6.5 (🔶 shadow → live) a
tulajdonosé. A pipeline változatlanul a v0-t futtatja.
