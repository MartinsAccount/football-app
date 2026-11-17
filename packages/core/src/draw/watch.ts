// Döntetlen-figyelő (D2, ROADMAP 12.7): közelgő meccsek pont-idejű döntetlen-jellemzői és p(X) szerinti rangsora a rögzített
// `draw-logreg` modellel. Rangsor + magyarázat, NEM értéktipp (a D1 holdouton a modell nem verte kimutathatóan a piacot).
// Tiszta függvények, I/O nincs.
import { createEloState, DEFAULT_ELO_PARAMS, ratingAt, updateElo, type EloParams } from '../model/elo';
import type { PlayedMatch, TeamId } from '../features/types';
import {
	createDrawHistory,
	DEFAULT_DRAW_HISTORY_OPTIONS,
	leagueDrawRate,
	recordDrawResult,
	teamDrawRate,
	type DrawFeatures,
	type DrawHistoryOptions,
	type DrawModelInput
} from './features';
import { predictDraw, type DrawModel, type DrawPrediction } from './model';

/** Egy figyelt (még le nem játszott vagy a kezdés előtti állapotában nézett) meccs. */
export interface DrawWatchTarget {
	id: number;
	kickoff: string;
	homeTeamId: TeamId;
	awayTeamId: TeamId;
	league: string;
	/** Piaci fair p(X) a kezdés előtti odds-ból. */
	pMarket: number;
}

/**
 * A célmeccsek jellemzői a saját kezdésük pillanatában: az Elo és a döntetlen-történet csak a kezdés előtt befejezett
 * meccsekből épül (a `history` sorrendje mindegy). Modell-predikció nélküli meccs kimarad.
 */
export const drawFeaturesAt = (
	history: readonly (PlayedMatch & { league: string })[],
	targets: readonly DrawWatchTarget[],
	model: ReadonlyMap<number, DrawModelInput>,
	opts: { elo?: EloParams; history?: DrawHistoryOptions } = {}
): Map<number, DrawFeatures> => {
	const eloP = opts.elo ?? DEFAULT_ELO_PARAMS;
	const histO = opts.history ?? DEFAULT_DRAW_HISTORY_OPTIONS;
	const played = [...history].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const sortedTargets = [...targets].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const elo = createEloState();
	const hist = createDrawHistory();
	const out = new Map<number, DrawFeatures>();
	let i = 0;
	for (const t of sortedTargets) {
		const ms = Date.parse(t.kickoff);
		for (; i < played.length && Date.parse(played[i].kickoff) < ms; i++) {
			updateElo(elo, played[i], eloP);
			recordDrawResult(hist, played[i]);
		}
		const pred = model.get(t.id);
		if (!pred || !(t.pMarket > 0 && t.pMarket < 1)) continue;
		const gap = ratingAt(elo, t.homeTeamId, ms, eloP) + eloP.homeAdvantage - ratingAt(elo, t.awayTeamId, ms, eloP);
		out.set(t.id, {
			pMarket: t.pMarket,
			pModel: pred.pDraw,
			eloGap: Math.abs(gap),
			expectedGoals: pred.lambdaHome + pred.lambdaAway,
			teamDrawRate: (teamDrawRate(hist, t.homeTeamId, t.league, histO) + teamDrawRate(hist, t.awayTeamId, t.league, histO)) / 2,
			leagueDrawRate: leagueDrawRate(hist, t.league, histO)
		});
	}
	return out;
};

export interface RankedDraw extends DrawPrediction {
	id: number;
}

/** p(X) szerint csökkenő rangsor (döntetlen: id), legfeljebb `limit` elem, legfeljebb `topFactors` magyarázó tényezővel. */
export const rankDraws = (
	model: DrawModel,
	features: ReadonlyMap<number, DrawFeatures>,
	opts: { limit?: number; topFactors?: number } = {}
): RankedDraw[] =>
	[...features]
		.map(([id, f]) => {
			const p = predictDraw(model, f);
			return { id, ...p, factors: p.factors.slice(0, opts.topFactors ?? 3) };
		})
		.sort((a, b) => b.pDraw - a.pDraw || a.id - b.id)
		.slice(0, opts.limit ?? Infinity);
