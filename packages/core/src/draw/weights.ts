// Generált fájl (`npm run backtest:draws -w @football/db`), kézzel ne szerkeszd.
// A `draw-logreg@1.0.0` végső modellje: 2022/2023 + 2023/2024 (football-data.co.uk CSV, top 5 liga), λ = 30
// (a 2023/2024-as validáción választva). Riport: docs/analysis/backtests/2026-11-17-draws.md.
import type { DrawModel } from './model';

export const DRAW_MODEL_FITTED: DrawModel = {
	version: 'draw-logreg@1.0.0',
	lambda: 30,
	// [konstans, logit(p_piac), ...DRAW_FACTOR_KEYS]
	weights: [
		0.3180383326942256, 1.4216278148392705, -0.1183247492368795, 0.1639046560710039, 0.0823181048002039, 0.02273614109270589,
		-0.11461220859617191
	],
	trainSize: 3373,
	converged: true
};
