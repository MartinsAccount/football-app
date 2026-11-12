// Piaci baseline (B0, ROADMAP 5.1): margin-mentesítés, konszenzus, legjobb odds. Tiszta függvények.
// Egy piac kimeneteinek oddsai mindig azonos sorrendben jönnek (pl. 1X2: [Home, Draw, Away]).

const assertValidOdds = (odds: readonly number[]) => {
	if (odds.length < 2) throw new Error('Egy piachoz legalább 2 kimenet kell.');
	for (const o of odds) if (!(Number.isFinite(o) && o > 1)) throw new Error(`Érvénytelen odds: ${o}`);
};

/** Implikált valószínűségek: 1/odds (a margint még tartalmazzák, Σ > 1). */
export const impliedProbabilities = (odds: readonly number[]): number[] => {
	assertValidOdds(odds);
	return odds.map((o) => 1 / o);
};

/** Iroda-margin (overround): Σ(1/odds) − 1. `< 0` esetén az irodák között arbitrázs van. */
export const overround = (odds: readonly number[]): number => impliedProbabilities(odds).reduce((s, p) => s + p, 0) - 1;

/** Fair valószínűség arányos margin-mentesítéssel: (1/odd_i) / Σ(1/odd). Σp = 1. */
export const fairProbabilities = (odds: readonly number[]): number[] => {
	const implied = impliedProbabilities(odds);
	const sum = implied.reduce((s, p) => s + p, 0);
	return implied.map((p) => p / sum);
};

/** Konszenzus fair valószínűség: irodánként fair p, ezek átlaga, újranormálva (Σp = 1). */
export const consensusFairProbabilities = (oddsByBookmaker: readonly (readonly number[])[]): number[] => {
	if (oddsByBookmaker.length === 0) throw new Error('Legalább egy iroda oddsa kell.');
	const n = oddsByBookmaker[0].length;
	if (oddsByBookmaker.some((o) => o.length !== n)) throw new Error('Az irodák kimenetszáma eltér.');
	const sums = new Array<number>(n).fill(0);
	for (const odds of oddsByBookmaker) fairProbabilities(odds).forEach((p, i) => (sums[i] += p));
	const total = sums.reduce((s, p) => s + p, 0);
	return sums.map((s) => s / total);
};

export interface BestOdd {
	odds: number;
	/** Az `oddsByBookmaker` tömbbeli index (holtversenynél az első). */
	bookmakerIndex: number;
}

/** Kimenetenként a legjobb (legmagasabb) odds és az iroda indexe. */
export const bestOdds = (oddsByBookmaker: readonly (readonly number[])[]): BestOdd[] => {
	if (oddsByBookmaker.length === 0) throw new Error('Legalább egy iroda oddsa kell.');
	const n = oddsByBookmaker[0].length;
	if (oddsByBookmaker.some((o) => o.length !== n)) throw new Error('Az irodák kimenetszáma eltér.');
	oddsByBookmaker.forEach(assertValidOdds);
	return Array.from({ length: n }, (_, i) =>
		oddsByBookmaker.reduce<BestOdd>((best, odds, b) => (odds[i] > best.odds ? { odds: odds[i], bookmakerIndex: b } : best), {
			odds: oddsByBookmaker[0][i],
			bookmakerIndex: 0
		})
	);
};
