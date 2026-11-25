import { formatDecimal, formatEv } from '../format/format';
import { marketLabel } from '../odds/history';
import type { EvaluationSummary, ProbabilityScore } from './dbSummary';

/**
 * Az „Élő (DB)” blokk nézet-modellje (ROADMAP 5.5, I17b; I17c óta a core-ban, web + mobil közös) a `GET /api/evaluation` összesítéséből (core `summarizeEvaluations`).
 * Csak formáz; a KPI-k a backtest-nézet KPI-jait használják (ugyanaz a `BetSummary`).
 */

const count = (n: number): string => formatDecimal(n, 0);
const score = (x: number | null): string => (x === null ? '–' : formatDecimal(x, 3));

/** A modellverzió-választó értéke „minden verzió” esetén. */
export const ALL_MODELS = '';

export const modelOptions = (s: EvaluationSummary): { value: string; label: string }[] => [
	{ value: ALL_MODELS, label: 'Minden verzió' },
	...s.modelVersions.map((m) => ({ value: m, label: m }))
];

/** Oldalfej-chipek: kiértékelt sorok + Brier-csoportok száma. */
export const liveChips = (s: EvaluationSummary): string[] => [
	`${count(s.records)} kiértékelt predikció`,
	`${count(s.predictions.groups)} piac-csoport`
];

export interface ILiveMarketRow {
	key: string;
	label: string;
	groups: string;
	brier: string;
	logLoss: string;
	bets: string;
	roi: string;
	roiTone: 'positive' | 'negative' | undefined;
	total?: boolean;
}

const row = (key: string, label: string, p: ProbabilityScore, b: EvaluationSummary['bets'], total?: boolean): ILiveMarketRow => ({
	key,
	label,
	groups: count(p.groups),
	brier: score(p.meanBrier),
	logLoss: score(p.meanLogLoss),
	bets: count(b.n),
	roi: b.roi === null ? '–' : formatEv(b.roi),
	roiTone: b.roi === null || b.roi === 0 ? undefined : b.roi > 0 ? 'positive' : 'negative',
	total
});

/** Piaconkénti sorok (core `marketLabel`), a végén az összesítő sor. */
export const liveMarketRows = (s: EvaluationSummary): ILiveMarketRow[] => [
	...s.markets.map((m) => row(String(m.marketId), marketLabel(m.marketId), m, m.bets)),
	row('all', 'Összesen', s.predictions, s.bets, true)
];
