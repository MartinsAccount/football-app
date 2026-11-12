// Poisson / Dixon–Coles eredménymátrix (strategy.md §4.3): egy mátrixból az 1X2, az O/U 2.5 és a BTTS, egymással konzisztensen.

export const MAX_GOALS = 10;

export const poissonPmf = (k: number, lambda: number): number => {
	if (!Number.isInteger(k) || k < 0) throw new Error(`Érvénytelen gólszám: ${k}`);
	if (!(lambda > 0)) throw new Error(`Érvénytelen λ: ${lambda}`);
	let p = Math.exp(-lambda);
	for (let i = 1; i <= k; i++) p *= lambda / i;
	return p;
};

/** Dixon–Coles τ-korrekció az alacsony eredményekre (ρ < 0 → több 0–0 és 1–1). */
export const dixonColesTau = (h: number, a: number, lambdaHome: number, lambdaAway: number, rho: number): number => {
	if (h === 0 && a === 0) return 1 - lambdaHome * lambdaAway * rho;
	if (h === 0 && a === 1) return 1 + lambdaHome * rho;
	if (h === 1 && a === 0) return 1 + lambdaAway * rho;
	if (h === 1 && a === 1) return 1 - rho;
	return 1;
};

/** P(hazai = i, vendég = j), i, j = 0…maxGoals; 1-re normálva (a csonkolás és a τ miatt). */
export const scoreMatrix = (lambdaHome: number, lambdaAway: number, rho = 0, maxGoals = MAX_GOALS): number[][] => {
	const ph = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaHome));
	const pa = Array.from({ length: maxGoals + 1 }, (_, k) => poissonPmf(k, lambdaAway));
	const m = ph.map((x, i) => pa.map((y, j) => Math.max(0, x * y * dixonColesTau(i, j, lambdaHome, lambdaAway, rho))));
	const total = m.reduce((s, row) => s + row.reduce((t, v) => t + v, 0), 0);
	return m.map((row) => row.map((v) => v / total));
};

export interface MarketProbabilities {
	home: number;
	draw: number;
	away: number;
	over25: number;
	under25: number;
	bttsYes: number;
	bttsNo: number;
}

export const marketProbabilities = (matrix: readonly (readonly number[])[]): MarketProbabilities => {
	let home = 0;
	let draw = 0;
	let away = 0;
	let over25 = 0;
	let bttsYes = 0;
	matrix.forEach((row, i) =>
		row.forEach((p, j) => {
			if (i > j) home += p;
			else if (i === j) draw += p;
			else away += p;
			if (i + j > 2.5) over25 += p;
			if (i > 0 && j > 0) bttsYes += p;
		})
	);
	return { home, draw, away, over25, under25: 1 - over25, bttsYes, bttsNo: 1 - bttsYes };
};
