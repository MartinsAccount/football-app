// Modell v0 `elo-poisson@0.1.0` (S13): az Elo-különbség viszi a fölényt, a liga gólátlaga a hazai előnyt, a csapatok tempója
// a gólszámot; ezekből λ-k → Dixon–Coles eredménymátrix → 1X2, O/U 2.5, BTTS. Indoklás: ablációs bontás (strategy.md §4.4).
// A paraméterek most fixek (szakirodalmi nagyságrend); az illesztés a backtest (S15) után jön.
import type { UpcomingFixture } from '../features/matchFeatures';
import { playedBefore, type PlayedMatch } from '../features/types';
import { formatPp } from '../format/format';
import { DEFAULT_ELO_PARAMS, eloRatings, ratingAt, type EloParams, type EloState } from './elo';
import { marketProbabilities, scoreMatrix, type MarketProbabilities } from './poisson';

export const ELO_POISSON_VERSION = 'elo-poisson@0.1.0';

export interface EloPoissonParams {
	elo: EloParams;
	/** log λ érzékenysége a `(R_h − R_a)/400` különbségre. */
	eloGoalSlope: number;
	/** Dixon–Coles ρ. */
	rho: number;
	/** Liga-prior (hazai / vendég gól/meccs), ha kevés a ligameccs. */
	priorHomeGoals: number;
	priorAwayGoals: number;
	/** A prior súlya meccsben. */
	priorWeight: number;
	/** A ligaátlag ablaka (utolsó N ligameccs). */
	leagueWindow: number;
	/** A tempó ablaka (a csapat utolsó N meccse). */
	tempoWindow: number;
	/** A tempó shrinkage-e a ligaátlag felé (meccsben). */
	tempoShrinkage: number;
}

export const DEFAULT_ELO_POISSON_PARAMS: EloPoissonParams = {
	elo: DEFAULT_ELO_PARAMS,
	eloGoalSlope: 0.6,
	rho: -0.08,
	priorHomeGoals: 1.5,
	priorAwayGoals: 1.2,
	priorWeight: 50,
	leagueWindow: 380,
	tempoWindow: 20,
	tempoShrinkage: 10
};

export interface EloPoissonInput {
	homeRating: number;
	awayRating: number;
	/** Liga hazai / vendég gól/meccs (μ). */
	leagueHomeGoals: number;
	leagueAwayGoals: number;
	/** Gólszám-szorzó (1 = ligaátlag). */
	homeTempo: number;
	awayTempo: number;
}

export interface EloPoissonCore {
	lambdaHome: number;
	lambdaAway: number;
	probabilities: MarketProbabilities;
}

export const predictEloPoisson = (
	input: EloPoissonInput,
	params: EloPoissonParams = DEFAULT_ELO_POISSON_PARAMS
): EloPoissonCore => {
	const d = (input.homeRating - input.awayRating) / 400;
	const tempo = Math.sqrt(input.homeTempo * input.awayTempo);
	const lambdaHome = input.leagueHomeGoals * Math.exp(params.eloGoalSlope * d) * tempo;
	const lambdaAway = input.leagueAwayGoals * Math.exp(-params.eloGoalSlope * d) * tempo;
	return { lambdaHome, lambdaAway, probabilities: marketProbabilities(scoreMatrix(lambdaHome, lambdaAway, params.rho)) };
};

export type EloPoissonFactor = 'elo' | 'homeAdvantage' | 'tempo';

export interface FactorContribution {
	factor: EloPoissonFactor;
	/** A valószínűség változása százalékpontban, ha a tényezőt semlegesre állítjuk (teljes − ablált). */
	deltaPp: MarketProbabilities;
	/** Magyar, egymondatos indoklás. */
	text: string;
}

const ablate = (input: EloPoissonInput, factor: EloPoissonFactor): EloPoissonInput => {
	if (factor === 'elo') return { ...input, awayRating: input.homeRating };
	if (factor === 'tempo') return { ...input, homeTempo: 1, awayTempo: 1 };
	const mean = (input.leagueHomeGoals + input.leagueAwayGoals) / 2;
	return { ...input, leagueHomeGoals: mean, leagueAwayGoals: mean };
};

const diffPp = (a: MarketProbabilities, b: MarketProbabilities): MarketProbabilities => {
	const out = {} as MarketProbabilities;
	for (const k of Object.keys(a) as (keyof MarketProbabilities)[]) out[k] = (a[k] - b[k]) * 100;
	return out;
};

const factorText = (factor: EloPoissonFactor, input: EloPoissonInput, d: MarketProbabilities): string => {
	if (factor === 'elo') {
		const gap = Math.round(input.homeRating - input.awayRating);
		if (Math.abs(gap) < 15) return 'A két csapat Elo-ereje közel azonos.';
		const side = gap > 0 ? 'hazai' : 'vendég';
		const pp = gap > 0 ? d.home : d.away;
		return `A ${side} csapat ${Math.abs(gap)} Elo-ponttal erősebb (${formatPp(pp)} a ${side} győzelemre).`;
	}
	if (factor === 'homeAdvantage') return `Hazai pálya: ${formatPp(d.home)} a hazai győzelemre.`;
	if (Math.abs(d.over25) < 1) return 'A csapatok gólátlaga a ligaátlag körül van.';
	return `${d.over25 > 0 ? 'Gólgazdag' : 'Gólszegény'} csapatok: ${formatPp(d.over25)} a 2,5 gól fölöttire.`;
};

/** Ablációs tényező-bontás, a legnagyobb hatású elöl. */
export const explainEloPoisson = (
	input: EloPoissonInput,
	params: EloPoissonParams = DEFAULT_ELO_POISSON_PARAMS
): FactorContribution[] => {
	const full = predictEloPoisson(input, params).probabilities;
	const factors: EloPoissonFactor[] = ['elo', 'homeAdvantage', 'tempo'];
	const impact = (c: FactorContribution) => Math.max(...Object.values(c.deltaPp).map(Math.abs));
	return factors
		.map((factor) => {
			const deltaPp = diffPp(full, predictEloPoisson(ablate(input, factor), params).probabilities);
			return { factor, deltaPp, text: factorText(factor, input, deltaPp) };
		})
		.sort((a, b) => impact(b) - impact(a));
};

export interface LeagueGoals {
	matches: number;
	homeGoals: number;
	awayGoals: number;
}

/** Liga gólátlaga az utolsó `leagueWindow` meccsből, a priorhoz húzva. */
export const leagueGoals = (
	leagueMatches: readonly PlayedMatch[],
	asOf: string,
	params: EloPoissonParams = DEFAULT_ELO_POISSON_PARAMS
): LeagueGoals => {
	const ms = playedBefore(leagueMatches, asOf).slice(-params.leagueWindow);
	const w = params.priorWeight;
	const hg = ms.reduce((s, m) => s + m.homeGoals, 0);
	const ag = ms.reduce((s, m) => s + m.awayGoals, 0);
	return {
		matches: ms.length,
		homeGoals: (hg + w * params.priorHomeGoals) / (ms.length + w),
		awayGoals: (ag + w * params.priorAwayGoals) / (ms.length + w)
	};
};

/** A csapat meccseinek gólszáma a ligaátlaghoz képest (1 = átlag), shrinkage-dzsel. */
export const teamTempo = (
	history: readonly PlayedMatch[],
	teamId: number,
	asOf: string,
	leagueTotal: number,
	params: EloPoissonParams = DEFAULT_ELO_POISSON_PARAMS
): { matches: number; tempo: number } => {
	const ms = playedBefore(history, asOf)
		.filter((m) => m.homeTeamId === teamId || m.awayTeamId === teamId)
		.slice(-params.tempoWindow);
	const goals = ms.reduce((s, m) => s + m.homeGoals + m.awayGoals, 0);
	const k = params.tempoShrinkage;
	return { matches: ms.length, tempo: (goals + k * leagueTotal) / ((ms.length + k) * leagueTotal) };
};

export interface EloPoissonContext {
	/** Minden ismert meccs (Elo, tempó), szezonhatáron át. */
	history: readonly PlayedMatch[];
	/** A meccs ligájának meccsei (gólátlag); alap: `history`. */
	leagueMatches?: readonly PlayedMatch[];
	/** Kész Elo-állapot (backtest: inkrementálisan léptetve); alap: `eloRatings(history, kickoff)`. */
	elo?: EloState;
}

export interface EloPoissonPrediction extends EloPoissonCore {
	modelVersion: typeof ELO_POISSON_VERSION;
	fixtureId: number;
	asOf: string;
	/** A `prediction.features` JSON-ba. */
	inputs: EloPoissonInput & { homeMatches: number; awayMatches: number; leagueMatches: number };
	explanation: FactorContribution[];
}

/** Pont-idejű predikció egy közelgő meccsre (csak a kezdés előtti meccsekből). */
export const eloPoissonPrediction = (
	fixture: UpcomingFixture,
	ctx: EloPoissonContext,
	params: EloPoissonParams = DEFAULT_ELO_POISSON_PARAMS
): EloPoissonPrediction => {
	const asOf = fixture.kickoff;
	const t = Date.parse(asOf);
	const elo = ctx.elo ?? eloRatings(ctx.history, asOf, params.elo);
	const league = leagueGoals(ctx.leagueMatches ?? ctx.history, asOf, params);
	const total = league.homeGoals + league.awayGoals;
	const home = teamTempo(ctx.history, fixture.homeTeamId, asOf, total, params);
	const away = teamTempo(ctx.history, fixture.awayTeamId, asOf, total, params);
	const input: EloPoissonInput = {
		homeRating: ratingAt(elo, fixture.homeTeamId, t, params.elo),
		awayRating: ratingAt(elo, fixture.awayTeamId, t, params.elo),
		leagueHomeGoals: league.homeGoals,
		leagueAwayGoals: league.awayGoals,
		homeTempo: home.tempo,
		awayTempo: away.tempo
	};
	return {
		modelVersion: ELO_POISSON_VERSION,
		fixtureId: fixture.id,
		asOf,
		...predictEloPoisson(input, params),
		inputs: { ...input, homeMatches: home.matches, awayMatches: away.matches, leagueMatches: league.matches },
		explanation: explainEloPoisson(input, params)
	};
};
