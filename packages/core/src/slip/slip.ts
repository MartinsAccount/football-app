// Szelvény-matek (DESIGN.md §9): kötés eredő odds/esély/EV/min. odds, szingli-összevetés, nyeremény, kockázat.
// Függetlenséget feltételez a lábak között; ugyanarról a meccsről két tipp nem kerülhet egy szelvényre.

import { DEFAULT_EV_THRESHOLD, minOdds } from '../odds/value';

export interface SlipLeg {
	/** A meccs azonosítója — egy szelvényen egyedi. */
	fixtureId: number;
	/** A modell valószínűsége a tippre (0 < p ≤ 1). */
	pModel: number;
	/** Legjobb ismert odds (becslés, ha nincs beírt Tippmix-odds). */
	bestOdds: number;
	/** A felhasználó által beírt Tippmix-odds; ha van, ezzel számolunk. */
	tippmixOdds?: number;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface SlipSummary {
	/** Lábak száma. */
	legCount: number;
	/** Eredő odds = Π odds_i. */
	combinedOdds: number;
	/** Találati esély = Π p_i. */
	probability: number;
	/** Kötés EV = Π p_i × Π odds_i − 1 (egységnyi tétre). */
	ev: number;
	/** Kötés min. oddsa = Π min_i. */
	minCombinedOdds: number;
	/** Lehetséges nyeremény = tét × eredő odds. */
	payout: number;
	/** A kötés várható nyeresége Ft-ban = EV × tét. */
	expectedProfit: number;
	/** Szingli-összevetés: Σ (p_i × odds_i − 1) × tét — ugyanekkora téttel lábanként szingliben. */
	singlesExpectedProfit: number;
	risk: RiskLevel;
	/** Igaz, ha legalább egy láb a legjobb oddsból (nem beírt Tippmix-oddsból) számol. */
	estimated: boolean;
}

/** Kockázat a találati esélyből: ≥ 35% low · 15–35% medium · < 15% high. */
export const riskLevel = (probability: number): RiskLevel =>
	probability >= 0.35 ? 'low' : probability >= 0.15 ? 'medium' : 'high';

/** Szelvénytípus magyar neve a lábak számából (DESIGN.md §7.6). */
export const slipTypeName = (legCount: number): string => {
	const names = ['', 'Szingli', 'Dupla kötés', 'Hármas kötés', 'Négyes kötés', 'Ötös kötés', 'Hatos kötés'];
	return names[legCount] ?? `${legCount}-es kötés`;
};

/** A láb számításhoz használt oddsa: beírt Tippmix-odds, ha van, különben a legjobb odds. */
export const legOdds = (leg: SlipLeg): number => leg.tippmixOdds ?? leg.bestOdds;

/** Igaz, ha a meccsről már van tipp a szelvényen (a toggle ilyenkor letiltva). */
export const hasFixture = (legs: readonly SlipLeg[], fixtureId: number): boolean => legs.some((l) => l.fixtureId === fixtureId);

/** Dob, ha ugyanarról a meccsről több tipp van, vagy érvénytelen az odds. */
export const assertValidSlip = (legs: readonly SlipLeg[]): void => {
	const seen = new Set<number>();
	for (const leg of legs) {
		if (seen.has(leg.fixtureId)) throw new Error(`Ugyanarról a meccsről két tipp nem lehet egy szelvényen: ${leg.fixtureId}`);
		seen.add(leg.fixtureId);
		const odds = legOdds(leg);
		if (!(Number.isFinite(odds) && odds > 1)) throw new Error(`Érvénytelen odds: ${odds}`);
	}
};

/** Láb hozzáadása; dob, ha a meccsről már van tipp. Új tömböt ad vissza. */
export const addLeg = (legs: readonly SlipLeg[], leg: SlipLeg): SlipLeg[] => {
	const next = [...legs, leg];
	assertValidSlip(next);
	return next;
};

const product = (xs: readonly number[]): number => xs.reduce((acc, x) => acc * x, 1);

/** A teljes szelvény összesítése adott téttel. Üres szelvényre null. */
export const summarizeSlip = (
	legs: readonly SlipLeg[],
	stake: number,
	evThreshold: number = DEFAULT_EV_THRESHOLD
): SlipSummary | null => {
	if (legs.length === 0) return null;
	if (!(Number.isFinite(stake) && stake >= 0)) throw new Error(`Érvénytelen tét: ${stake}`);
	assertValidSlip(legs);

	const odds = legs.map(legOdds);
	const combinedOdds = product(odds);
	const probability = product(legs.map((l) => l.pModel));
	const ev = probability * combinedOdds - 1;
	const minCombinedOdds = product(legs.map((l) => minOdds(l.pModel, evThreshold)));
	const singlesExpectedProfit = legs.reduce((acc, l, i) => acc + (l.pModel * odds[i] - 1), 0) * stake;

	return {
		legCount: legs.length,
		combinedOdds,
		probability,
		ev,
		minCombinedOdds,
		payout: stake * combinedOdds,
		expectedProfit: ev * stake,
		singlesExpectedProfit,
		risk: riskLevel(probability),
		estimated: legs.some((l) => l.tippmixOdds === undefined)
	};
};

/**
 * Beírt odds értelmezése (DESIGN §7.7): vesszőt és pontot is elfogad, szóközt eldob.
 * Érvénytelen vagy ≤ 1 értékre null.
 */
export const parseOddsInput = (input: string): number | null => {
	const text = input.replace(/[\s ]/g, '').replace(',', '.');
	if (!/^\d+(\.\d+)?$/.test(text)) return null;
	const odds = Number(text);
	return Number.isFinite(odds) && odds > 1 ? odds : null;
};

/** Tippmixre vitel lábanként: `valid` = megéri, `below` = min. alatt, `missing` = odds kell (üres vagy érvénytelen). */
export type TransferStatus = 'valid' | 'below' | 'missing';

export const transferStatus = (tippmixOdds: number | null | undefined, minimumOdds: number): TransferStatus =>
	tippmixOdds == null ? 'missing' : tippmixOdds >= minimumOdds ? 'valid' : 'below';
