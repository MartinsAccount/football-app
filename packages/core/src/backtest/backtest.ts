// Walk-forward backtest (S15, ROADMAP 6.3, strategy.md §6): a meccseket kezdés szerint léptetjük; minden meccsre a modell CSAK a
// korábbi meccsekből jósol (az Elo inkrementális, az azonos kezdésű meccsek egymás eredményét nem látják). Összevetés a piaci
// baseline-nal (nyitó és záró átlag-odds, marzs nélkül), értéktippek flat téttel a nyitó oddson, CLV a záró oddshoz.
import { fairProbabilities } from '../model/market';
import { createEloState, updateElo } from '../model/elo';
import {
	DEFAULT_ELO_POISSON_PARAMS,
	ELO_POISSON_VERSION,
	eloPoissonPrediction,
	type EloPoissonParams
} from '../model/eloPoisson';
import type { PlayedMatch } from '../features/types';
import {
	calibrationBuckets,
	outcome1x2,
	overUnderOutcome,
	settleBet,
	summarizeBets,
	summarizeProbabilities,
	type BetSummary,
	type CalibrationBucket,
	type EvaluatedBet,
	type ProbabilisticSummary
} from '../evaluation/evaluation';

export type BacktestMarket = 'h2h' | 'ou25';
export const BACKTEST_MARKETS: readonly BacktestMarket[] = ['h2h', 'ou25'];

/** Egy piac oddsai, kimenet-sorrendben (h2h: hazai/döntetlen/vendég; ou25: over/under). */
export interface BacktestMarketOdds {
	/** A „megtehető” odds (egy iroda nyitó oddsa) – erre fogadunk. */
	taken?: readonly number[];
	/** Ugyanannak az irodának a záró oddsa – CLV. */
	takenClosing?: readonly number[];
	/** Piaci átlag nyitó / záró odds – baseline (marzs nélkül). */
	marketOpening?: readonly number[];
	marketClosing?: readonly number[];
}

export interface BacktestMatch extends PlayedMatch {
	league: string;
	season: number;
	odds: Partial<Record<BacktestMarket, BacktestMarketOdds>>;
}

export interface BacktestOptions {
	/** Ezekre a szezonokra készül predikció; a korábbiak csak bemelegítés (Elo, tempó, ligaátlag). */
	evalSeasons: readonly number[];
	/** Értéktipp, ha `p · odds − 1 ≥ küszöb` (strategy.md: 5%). */
	evThreshold?: number;
	params?: EloPoissonParams;
}

export interface BacktestRecord {
	id: number;
	league: string;
	season: number;
	kickoff: string;
	outcome: Record<BacktestMarket, number>;
	model: Record<BacktestMarket, number[]>;
	marketOpening: Partial<Record<BacktestMarket, number[]>>;
	marketClosing: Partial<Record<BacktestMarket, number[]>>;
	bets: Partial<Record<BacktestMarket, EvaluatedBet & { selection: number; ev: number }>>;
}

const pushCapped = <T>(map: Map<string | number, T[]>, key: string | number, item: T, cap: number) => {
	const list = map.get(key) ?? [];
	list.push(item);
	if (list.length > cap) list.shift();
	map.set(key, list);
};

const validOdds = (odds: readonly number[] | undefined, n: number): odds is readonly number[] =>
	!!odds && odds.length === n && odds.every((o) => o > 1);

/** Értéktipp: a legnagyobb EV-jű kimenet a `taken` oddson, ha `EV ≥ küszöb`; CLV a `takenClosing`-hoz. */
export const pickValueBet = (
	p: readonly number[],
	odds: BacktestMarketOdds | undefined,
	outcomeIndex: number,
	threshold: number
): (EvaluatedBet & { selection: number; ev: number }) | undefined => {
	if (!validOdds(odds?.taken, p.length)) return undefined;
	const taken = odds!.taken!;
	let best = -1;
	for (let i = 0; i < p.length; i++) if (best < 0 || p[i] * taken[i] > p[best] * taken[best]) best = i;
	const ev = p[best] * taken[best] - 1;
	if (ev < threshold) return undefined;
	const closing = validOdds(odds!.takenClosing, p.length) ? odds!.takenClosing![best] : null;
	return { selection: best, ev, odds: taken[best], p: p[best], outcome: settleBet(best, outcomeIndex), closingOdds: closing };
};

/** Walk-forward futás: predikció-rekordok az értékelt szezonok meccseire. Determinisztikus. */
export const runBacktest = (matches: readonly BacktestMatch[], options: BacktestOptions): BacktestRecord[] => {
	const params = options.params ?? DEFAULT_ELO_POISSON_PARAMS;
	const threshold = options.evThreshold ?? 0.05;
	const sorted = [...matches].sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
	const elo = createEloState();
	const teamRecent = new Map<string | number, PlayedMatch[]>();
	const leagueRecent = new Map<string | number, PlayedMatch[]>();
	const records: BacktestRecord[] = [];

	for (let i = 0; i < sorted.length; ) {
		let j = i;
		while (j < sorted.length && sorted[j].kickoff === sorted[i].kickoff) j++;
		const group = sorted.slice(i, j);
		for (const m of group) {
			if (!options.evalSeasons.includes(m.season)) continue;
			const seen = new Set<number>();
			const history = [...(teamRecent.get(m.homeTeamId) ?? []), ...(teamRecent.get(m.awayTeamId) ?? [])]
				.filter((x) => !seen.has(x.id) && seen.add(x.id))
				.sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff) || a.id - b.id);
			const pred = eloPoissonPrediction(m, { history, leagueMatches: leagueRecent.get(m.league) ?? [], elo }, params);
			const pr = pred.probabilities;
			const model: Record<BacktestMarket, number[]> = { h2h: [pr.home, pr.draw, pr.away], ou25: [pr.over25, pr.under25] };
			const ou = overUnderOutcome(m.homeGoals + m.awayGoals, 2.5)!;
			const outcome: Record<BacktestMarket, number> = { h2h: outcome1x2(m.homeGoals, m.awayGoals), ou25: ou };
			const rec: BacktestRecord = {
				id: m.id,
				league: m.league,
				season: m.season,
				kickoff: m.kickoff,
				outcome,
				model,
				marketOpening: {},
				marketClosing: {},
				bets: {}
			};
			for (const market of BACKTEST_MARKETS) {
				const odds = m.odds[market];
				const n = model[market].length;
				if (validOdds(odds?.marketOpening, n)) rec.marketOpening[market] = fairProbabilities(odds!.marketOpening!);
				if (validOdds(odds?.marketClosing, n)) rec.marketClosing[market] = fairProbabilities(odds!.marketClosing!);
				const bet = pickValueBet(model[market], odds, outcome[market], threshold);
				if (bet) rec.bets[market] = bet;
			}
			records.push(rec);
		}
		for (const m of group) {
			updateElo(elo, m, params.elo);
			pushCapped(teamRecent, m.homeTeamId, m, params.tempoWindow);
			pushCapped(teamRecent, m.awayTeamId, m, params.tempoWindow);
			pushCapped(leagueRecent, m.league, m, params.leagueWindow);
		}
		i = j;
	}
	return records;
};

export interface MarketComparison {
	/** Páros összevetés: csak azok a meccsek, ahol nyitó és záró piaci odds is van. */
	model: ProbabilisticSummary;
	marketOpening: ProbabilisticSummary;
	marketClosing: ProbabilisticSummary;
	bets: BetSummary;
}

export type SegmentSummary = Record<BacktestMarket, MarketComparison>;

export const summarizeSegment = (records: readonly BacktestRecord[]): SegmentSummary => {
	const out = {} as SegmentSummary;
	for (const market of BACKTEST_MARKETS) {
		const paired = records.filter((r) => r.marketOpening[market] && r.marketClosing[market]);
		const probs = (pick: (r: BacktestRecord) => number[]) =>
			summarizeProbabilities(paired.map((r) => ({ probabilities: pick(r), outcomeIndex: r.outcome[market] })));
		out[market] = {
			model: probs((r) => r.model[market]),
			marketOpening: probs((r) => r.marketOpening[market]!),
			marketClosing: probs((r) => r.marketClosing[market]!),
			bets: summarizeBets(records.flatMap((r) => (r.bets[market] ? [r.bets[market]!] : [])))
		};
	}
	return out;
};

export interface BacktestReport {
	modelVersion: string;
	evalSeasons: number[];
	evThreshold: number;
	matches: number;
	overall: SegmentSummary;
	bySeason: Record<string, SegmentSummary>;
	byLeague: Record<string, SegmentSummary>;
	/** A modell kalibrációja (minden kimenet egy pont). */
	calibration: Record<BacktestMarket, CalibrationBucket[]>;
}

const groupBy = (records: readonly BacktestRecord[], key: (r: BacktestRecord) => string) => {
	const groups = new Map<string, BacktestRecord[]>();
	for (const r of records) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
	return Object.fromEntries([...groups.keys()].sort().map((k) => [k, summarizeSegment(groups.get(k)!)]));
};

/** Riport a rekordokból: összesen, szezononként, ligánként + kalibráció. */
export const buildBacktestReport = (records: readonly BacktestRecord[], options: BacktestOptions): BacktestReport => ({
	modelVersion: ELO_POISSON_VERSION,
	evalSeasons: [...options.evalSeasons],
	evThreshold: options.evThreshold ?? 0.05,
	matches: records.length,
	overall: summarizeSegment(records),
	bySeason: groupBy(records, (r) => String(r.season)),
	byLeague: groupBy(records, (r) => r.league),
	calibration: {
		h2h: calibrationBuckets(records.flatMap((r) => r.model.h2h.map((p, i) => ({ p, hit: r.outcome.h2h === i })))),
		ou25: calibrationBuckets(records.flatMap((r) => r.model.ou25.map((p, i) => ({ p, hit: r.outcome.ou25 === i }))))
	}
});
