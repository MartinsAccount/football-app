// Döntetlen-figyelő jellemzői (D1, ROADMAP 12.6, docs/plans/owner-style-and-draws.md B rész). Tiszta függvények, I/O nincs.
// Minden jellemző meccs előtti (pont-idejű): az azonos kezdésű meccsek egymás eredményét nem látják.
import { createEloState, DEFAULT_ELO_PARAMS, ratingAt, updateElo, type EloParams, type EloState } from '../model/elo';
import { fairProbabilities } from '../model/market';
import type { PlayedMatch, TeamId } from '../features/types';

/** Egy meccs döntetlen-jellemzői (nyers, ember által olvasható egységben). */
export interface DrawFeatures {
	/** Piaci fair p(X): a nyitó átlag-odds marzs nélkül. */
	pMarket: number;
	/** A modell (Dixon–Coles) p(X)-e. */
	pModel: number;
	/** |Elo_hazai + hazai előny − Elo_vendég| Elo-pontban (0 = teljesen kiegyenlített). */
	eloGap: number;
	/** Várható gólösszeg (λ_hazai + λ_vendég). */
	expectedGoals: number;
	/** A két csapat korábbi (ligaátlag felé húzott) döntetlen-arányának átlaga. */
	teamDrawRate: number;
	/** A liga eddigi (globális prior felé húzott) döntetlen-aránya. */
	leagueDrawRate: number;
}

export type DrawFeatureKey = 'market' | 'model' | 'elo' | 'goals' | 'teams' | 'league';

/** A logreg oszlopai: [konstans, logit(p_piac), majd a tényezők]; a tényezők sorrendje = `DRAW_FACTOR_KEYS`. */
export const DRAW_FACTOR_KEYS: readonly Exclude<DrawFeatureKey, 'market'>[] = ['model', 'elo', 'goals', 'teams', 'league'];
export const DRAW_VECTOR_LENGTH = 2 + DRAW_FACTOR_KEYS.length;

/** Referenciaszintek (a tényező 0-ja): top-5 liga 2022–2024 körüli átlagok. */
export const DRAW_REFERENCE = { goals: 2.7, drawRate: 0.26 } as const;

const P_EPS = 1e-6;
export const logit = (p: number): number => {
	const q = Math.min(1 - P_EPS, Math.max(P_EPS, p));
	return Math.log(q / (1 - q));
};

/**
 * Jellemző-vektor. A piaci logit büntetés nélküli oszlop, a többi a piachoz/referenciához képesti eltérés, így a csupa 0
 * tényező-súly pontosan a piacot adja vissza (az L2 a piac felé húz).
 */
export const drawFeatureVector = (f: DrawFeatures): number[] => [
	1,
	logit(f.pMarket),
	logit(f.pModel) - logit(f.pMarket),
	f.eloGap / 100,
	f.expectedGoals - DRAW_REFERENCE.goals,
	(f.teamDrawRate - f.leagueDrawRate) * 10,
	(f.leagueDrawRate - DRAW_REFERENCE.drawRate) * 10
];

// --- Döntetlen-történet (csapat + liga) ---

export interface DrawHistory {
	teams: Map<TeamId, { n: number; draws: number }>;
	leagues: Map<string, { n: number; draws: number }>;
}

export interface DrawHistoryOptions {
	/** Csapat-arány húzása a liga-arány felé (pszeudo-meccs). */
	teamPrior: number;
	/** Liga-arány húzása a globális referencia felé (pszeudo-meccs). */
	leaguePrior: number;
}

export const DEFAULT_DRAW_HISTORY_OPTIONS: DrawHistoryOptions = { teamPrior: 10, leaguePrior: 50 };

export const createDrawHistory = (): DrawHistory => ({ teams: new Map(), leagues: new Map() });

const shrunk = (c: { n: number; draws: number } | undefined, prior: number, k: number) =>
	((c?.draws ?? 0) + k * prior) / ((c?.n ?? 0) + k);

export const leagueDrawRate = (h: DrawHistory, league: string, o: DrawHistoryOptions = DEFAULT_DRAW_HISTORY_OPTIONS) =>
	shrunk(h.leagues.get(league), DRAW_REFERENCE.drawRate, o.leaguePrior);

export const teamDrawRate = (
	h: DrawHistory,
	teamId: TeamId,
	league: string,
	o: DrawHistoryOptions = DEFAULT_DRAW_HISTORY_OPTIONS
) => shrunk(h.teams.get(teamId), leagueDrawRate(h, league, o), o.teamPrior);

export const recordDrawResult = (h: DrawHistory, m: PlayedMatch & { league: string }): DrawHistory => {
	const d = m.homeGoals === m.awayGoals ? 1 : 0;
	const bump = <K>(map: Map<K, { n: number; draws: number }>, k: K) => {
		const c = map.get(k) ?? { n: 0, draws: 0 };
		map.set(k, { n: c.n + 1, draws: c.draws + d });
	};
	bump(h.teams, m.homeTeamId);
	bump(h.teams, m.awayTeamId);
	bump(h.leagues, m.league);
	return h;
};

// --- Walk-forward minták ---

export interface DrawSourceMatch extends PlayedMatch {
	league: string;
	season: number;
	/** Nyitó átlag 1X2-odds (hazai/döntetlen/vendég); hiányában a meccs nem kap mintát. */
	marketOpening1x2?: readonly number[];
}

/** A modell (pl. Dixon–Coles) meccs előtti kimenete. */
export interface DrawModelInput {
	pDraw: number;
	lambdaHome: number;
	lambdaAway: number;
}

export interface DrawSample<M extends DrawSourceMatch = DrawSourceMatch> {
	match: M;
	features: DrawFeatures;
	/** 1, ha döntetlen lett. */
	isDraw: 0 | 1;
}

/**
 * Kezdés szerint léptetve a meccs előtti jellemzők; minta csak ott, ahol van modell-predikció és piaci odds. Az Elo és a
 * döntetlen-történet minden (korábbi) meccsből épül, az azonos kezdésű meccsek csoportja a frissítés előtt kap jellemzőt.
 */
export const buildDrawSamples = <M extends DrawSourceMatch>(
	matches: readonly M[],
	model: ReadonlyMap<number, DrawModelInput>,
	opts: { elo?: EloParams; history?: DrawHistoryOptions } = {}
): DrawSample<M>[] => {
	const eloP = opts.elo ?? DEFAULT_ELO_PARAMS;
	const histO = opts.history ?? DEFAULT_DRAW_HISTORY_OPTIONS;
	const sorted = [...matches].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const elo: EloState = createEloState();
	const hist = createDrawHistory();
	const out: DrawSample<M>[] = [];
	for (let i = 0; i < sorted.length; ) {
		const t = sorted[i].kickoff;
		let j = i;
		while (j < sorted.length && sorted[j].kickoff === t) j++;
		const group = sorted.slice(i, j);
		const ms = Date.parse(t);
		for (const m of group) {
			const pred = model.get(m.id);
			const odds = m.marketOpening1x2;
			if (!pred || !odds || odds.length !== 3 || odds.some((o) => !(o > 1))) continue;
			const gap = ratingAt(elo, m.homeTeamId, ms, eloP) + eloP.homeAdvantage - ratingAt(elo, m.awayTeamId, ms, eloP);
			out.push({
				match: m,
				isDraw: m.homeGoals === m.awayGoals ? 1 : 0,
				features: {
					pMarket: fairProbabilities(odds)[1],
					pModel: pred.pDraw,
					eloGap: Math.abs(gap),
					expectedGoals: pred.lambdaHome + pred.lambdaAway,
					teamDrawRate:
						(teamDrawRate(hist, m.homeTeamId, m.league, histO) + teamDrawRate(hist, m.awayTeamId, m.league, histO)) / 2,
					leagueDrawRate: leagueDrawRate(hist, m.league, histO)
				}
			});
		}
		for (const m of group) {
			updateElo(elo, m, eloP);
			recordDrawResult(hist, m);
		}
		i = j;
	}
	return out;
};
