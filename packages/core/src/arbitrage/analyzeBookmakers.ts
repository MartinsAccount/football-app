import { BETS_TYPES } from '../constants/betTypes';
import { Bet, BetsValue, Bookmaker } from '../odds/types';
import { IArbitrage, IHighestOdds } from './types';

// Tiszta függvény: nincs store-, API- vagy DOM-függőség, ezért unit-tesztelhető
// (analyzeBookmakers.test.ts). Az ArbitrageStore.analyzeBookmaker erre delegál.

const {
	Vegeredmeny,
	ElsoFelidoVegeredmeny,
	MasodikFelidoVegeredmeny,
	HazaiVagyVendeg,
	MindketCsapatGol,
	ElsoFelidoMindketCsapatGol,
	MasodikFelidoMindketCsapatGol,
	HazaiMindketFelidoGyozelem,
	VendegMindketFelidoGyozelem,
	GolokSzama,
	HazaiGolokSzama,
	VendegGolokSzama
} = BETS_TYPES;

/** 2 kimenetelű típusok — az API `values` sorrendje szerint (pl. Yes/No, Home/Away). */
export const TWO_OUTCOME_BET_TYPES: BETS_TYPES[] = [
	HazaiVagyVendeg,
	MindketCsapatGol,
	ElsoFelidoMindketCsapatGol,
	MasodikFelidoMindketCsapatGol,
	HazaiMindketFelidoGyozelem,
	VendegMindketFelidoGyozelem
];

/** 3 kimenetelű típusok (1X2) — az API `values` sorrendje: Home, Draw, Away. */
export const THREE_OUTCOME_BET_TYPES: BETS_TYPES[] = [Vegeredmeny, ElsoFelidoVegeredmeny, MasodikFelidoVegeredmeny];

/** Gólvonalas típusok: `Over X` / `Under X` a megadott `expectGoals` vonalra. */
export const GOAL_LINE_BET_TYPES: BETS_TYPES[] = [GolokSzama, HazaiGolokSzama, VendegGolokSzama];

const emptyOutcomes = (names: string[]): IHighestOdds[] => names.map((name) => ({ name, bookmaker: '', odd: 0 }));

/**
 * Egy meccs összes irodájából kimenetelenként kiválasztja a legmagasabb oddsot, és kiszámolja az
 * arbitrázs-arányt: `Σ 1/odd_max` (3 tizedesre kerekítve). `< 1` → garantált profit.
 *
 * - Ha egy kimenetelre egyetlen iroda sem ad oddsot, az odd 0 marad, így az arány `Infinity`
 *   (= nincs arbitrázs).
 * - Ha a típus egyik csoportba sem tartozik, `arbitrage: null`, `highestOdds: null`.
 */
export function analyzeBookmakers(bookmakers: Bookmaker[], betType: BETS_TYPES, expectGoals?: number): IArbitrage {
	const isTwo = TWO_OUTCOME_BET_TYPES.includes(betType);
	const isThree = THREE_OUTCOME_BET_TYPES.includes(betType);
	const isGoalLine = GOAL_LINE_BET_TYPES.includes(betType);

	if (!isTwo && !isThree && !isGoalLine) return { name: betType, highestOdds: null, arbitrage: null };

	const outcomes = isThree
		? emptyOutcomes(['highestHome', 'highestDraw', 'highestAway'])
		: emptyOutcomes(['highestHome', 'highestAway']);

	const consider = (index: number, item: BetsValue | undefined, bookmakerName: string) => {
		const slot = outcomes[index];
		if (!slot || !item) return; // több kimenetel jött, mint amennyit a típus vár → a többlet nem számít
		if (Number(item.odd) > slot.odd) {
			slot.name = item.value;
			slot.odd = Number(item.odd);
			slot.bookmaker = bookmakerName;
		}
	};

	bookmakers.forEach((bookmaker: Bookmaker) => {
		const selectedBet = bookmaker.bets.find((bet: Bet) => bet.name === betType);
		if (!selectedBet) return;

		if (isGoalLine) {
			[`Over ${expectGoals}`, `Under ${expectGoals}`].forEach((param, index) =>
				consider(
					index,
					selectedBet.values?.find((item: BetsValue) => item?.value === param),
					bookmaker.name
				)
			);
			return;
		}

		selectedBet.values?.forEach((item: BetsValue, index) => consider(index, item, bookmaker.name));
	});

	const sum = outcomes.reduce((acc, item) => acc + 1 / item.odd, 0);

	return { name: betType, highestOdds: outcomes, arbitrage: Number(sum.toFixed(3)) };
}
