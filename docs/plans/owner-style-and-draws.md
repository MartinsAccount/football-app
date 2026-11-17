# Terv: „Saját stílus” (a tulajdonos döntéseinek utánzása) + döntetlen-figyelő

Forrás: tulajdonosi kérés, 2026-11-17. Az élő ajánlási szabályok **maradnak** (DECISIONS 2026-11-17).

## A) Saját stílus – kvíz + profil (ROADMAP 12.1–12.5)

- **Kvíz:** a DB-ben lévő *lejátszott* 2022–2024-es meccsekből kérdés: csapatok, liga, nyitó 1X2 + O/U 2,5 odds, forma (utolsó 5),
  tabellahely. Válasz: `1 | X | 2 | over | under | skip` (+ opcionális bizalom 1–3). Az eredményt csak a válasz **után** mutatjuk.
- **Tanítóminta:** kvíz-válaszok + a rögzített saját fogadások (`placed_bet`, I23).
- **Modell (megmagyarázható, PRD 8):** kimenetenkénti L2-regularizált logisztikus regresszió kevés, nevesített jellemzőn
  (odds-sáv, favorit/esélytelen, hazai/vendég, formakülönbség, tabella-különbség, liga, piaci EV a modellünk szerint). A profil
  szövegesen: a 3 legerősebb súly („Kedveled a 1,5–2,0 közti hazai favoritokat”).
- **Utánzás:** a mai meccseken „Te ezt raknád” jelölés a profil szerint (≥ 20 válasz után; előtte „kevés adat”).
- **Mérés:** keresztvalidált egyezés a válaszaiddal vs. „mindig a favorit” baseline.

## B) Döntetlen-figyelő (ROADMAP 12.6–12.8)

- Jellemzők: piaci fair p(X), a modell p(X) (Dixon–Coles mátrix), |Elo-különbség|, várható gólösszeg, a két csapat
  döntetlen-aránya, liga döntetlen-aránya.
- Modell: logisztikus regresszió (train 2022, valid 2023, holdout 2024 egyszer), kimenet: p(X) + magyarázó tényezők.
- Riport: top-N döntetlenjelölt találati aránya és ROI a nyitó X-oddson, vs. piac. Az eredményt őszintén riportoljuk.
- UI: „Döntetlen-esélyek” blokk (web + mobil), rangsor + miért.

## Szeletek

| Szelet | Tartalom |
|---|---|
| Q1 | core `profile/`: kvíz-kérdés jellemzői, válasz-típus, logreg-illesztés, profil-szöveg, utánzó pontszám + tesztek |
| Q2 | db `0008_owner_answer.sql` (additív) + repository; server `GET /api/quiz/next`, `POST /api/quiz/answer`, `GET /api/profile` |
| Q3 | web `/quiz` oldal + profilkártya |
| Q4 | mobil `quiz` képernyő |
| Q5 | „Te ezt raknád” jelölés az ajánlás-listán (web + mobil) |
| D1 | core `draw/`: jellemzők + logreg + backtest-script/riport |
| D2 | server: döntetlen-rangsor a `/api/recommendations` mellé (`/api/draws`) + web blokk |
| D3 | mobil blokk |

Kockázat: kevés válasznál a profil zajos → minimum-mintaszám és „kevés adat” jelzés.
