// Érték-képletek (DESIGN.md §9): EV, edge, minimális vállalható odds.

/** Alapértelmezett EV-küszöb a min. oddshoz (5%). */
export const DEFAULT_EV_THRESHOLD = 0.05;

const assertProbability = (p: number) => {
	if (!(Number.isFinite(p) && p > 0 && p <= 1)) throw new Error(`Érvénytelen valószínűség: ${p}`);
};

/** EV = p_modell × odds − 1 (egységnyi tétre). */
export const expectedValue = (pModel: number, odds: number): number => {
	assertProbability(pModel);
	return pModel * odds - 1;
};

/** Edge százalékpontban, egészre kerekítve: round((p_modell − p_piac) × 100). */
export const edgePp = (pModel: number, pMarket: number): number => Math.round((pModel - pMarket) * 100);

/** Min. vállalható odds: (1 / p_modell) × (1 + EV-küszöb). Ennél alacsonyabb oddsnál nem éri meg. */
export const minOdds = (pModel: number, evThreshold: number = DEFAULT_EV_THRESHOLD): number => {
	assertProbability(pModel);
	return (1 / pModel) * (1 + evThreshold);
};
