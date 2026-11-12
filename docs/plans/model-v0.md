# Terv: modell v0 `elo-poisson@0.1.0` (S13)

Cél: 1X2 és O/U 2.5 (+ BTTS) valószínűség egy eredménymátrixból, tényező-hozzájárulással (strategy.md §4.2–4.4).

## Felépítés (`packages/core/src/model/`)

- `elo.ts` – inkrementális Elo: `createEloState`, `updateElo`, `eloRatings(matches, asOf)`. `ΔR = K · G(gk) · (S − E)`,
  `E = 1/(1+10^(−(R_h+H−R_a)/400))`; G: gk ≤ 1 → 1, 2 → 1,5, ≥ 3 → (11+gk)/8. Szezonszünet (> 45 nap): visszahúzás az átlag felé
  1/3-dal. Később érkező (feljutó) csapat: 1500 − 50.
- `poisson.ts` – `poissonPmf`, `scoreMatrix(λh, λa, ρ)` (0–10 gól, Dixon–Coles τ, normálás), `marketProbabilities`.
- `eloPoisson.ts` – `predictEloPoisson(input)`: `λ_h = μ_h · e^{b·d} · T`, `λ_a = μ_a · e^{−b·d} · T`, ahol `d = (R_h − R_a)/400`,
  μ = liga hazai/vendég gólátlag (shrinkage a priorhoz), `T = √(tempó_h · tempó_a)` (a csapat meccseinek gólszáma / ligaátlag,
  shrinkage). Az Elo a fölényt, a tempó a gólszámot viszi. `eloPoissonPrediction(fixture, { history, leagueMatches })`
  pont-idejűen összerakja a bemenetet.
- Indoklás: ablációs bontás (strategy §4.4): Elo (d = 0), hazai pálya (μ_h = μ_a), tempó (T = 1); pp-ben piaconként + magyar
  mondat a `formatPp`-vel.

## Nem része (DECISIONS)

- Ordinális logit-illesztés, ML-illesztett att/def, ρ/b illesztése → S15 backtest után (paraméterek most fixek).
- Forma Elo-reziduuma, motiváció-korrekció (v2 réteg).
