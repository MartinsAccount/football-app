# I23 – Fogadás rögzítése (ROADMAP 5.6) – szerveroldal

Cél: a tulajdonos ténylegesen megtett tippjei (Tippmix-odds, tét) a DB-ben, és a „saját” ROI a modell ROI-ja mellett. A
bukmékerhez leadás PRD-non-goal: csak rögzítés.

## Séma

A `placed_bet` tábla már létezik (0004): `prediction_id` (opcionális), `fixture_id`, `market_id`, `selection`, `line`,
`bookmaker_label`, `odd_taken > 1`, `stake > 0`, `placed_at`, `note`. Új migráció nem kell.

## Szeletek (ez a szelet: 1–4)

1. core `evaluation/ownBets.ts`: `placedBetOutcome` (a kapcsolt predikció `evaluation` kimenete, ha a tipp ugyanarra a kimenetre
   szól; különben a meccs eredményéből: 1X2 = piac 1, Gól O/U = piac 5 + vonal; PST/CANC/ABD → void; nem befejezett → függő),
   `stakeProfit`, `summarizeOwnBets(placed, evaluations)` → saját (tétsúlyos) ROI, saját flat ROI, a modell flat ROI-ja
   ugyanezeken a tippeken (a predikció `best_odd`-jával), és a modell összes ajánlásának ROI-ja.
2. db `placedBets.ts`: `SqlPlacedBetRepository` (`insert`, `list`), hivatkozás-ellenőrzés (`PlacedBetRefError`: hiányzó
   meccs/piac/predikció, más meccs predikciója). PGlite-teszt friss memória-DB-n.
3. server `placedBets.ts`: `parsePlacedBetInput` (400 hibás bemenetre), `readPlacedBets`; router `GET/POST /api/bets`; dev.ts
   bekötés.
4. contract: `PlacedBetInput`, `PlacedBetDto`, `PlacedBetsResponse`, kliens `listPlacedBets`/`createPlacedBet` (POST).
5. (külön szelet, I23b) web/mobil: a szelvény-mentés (`savedSlipsCodec`, `buildSavedSlip`) szerverre kötése, saját ROI a
   kiértékelés-oldalon.

## Ellenőrzés

core unit-teszt, db PGlite-teszt, server szerződés-teszt (201/200/400), `npm run verify`.
