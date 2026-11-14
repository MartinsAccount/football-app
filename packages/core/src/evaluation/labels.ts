import type { BacktestMarket, BacktestReport, SegmentSummary } from '../backtest/backtest';
import { EN_DASH, formatClv, formatDecimal, formatEv, formatPercent, formatSignedDecimal } from '../format/format';
import type { GoalKey, GoalResult, GoalStatus } from './goals';

/**
 * A Kiértékelés nézet platformfüggetlen címkéi és szövegei (web + mobil közös): piacok, liga- és szezonnevek, oldalfej-chipek,
 * szegmensek, sikermutató-sorok. Csak formáz; a számok a `goals.ts` / `verdict.ts` / backtest-riport értékei.
 */

export const EVAL_MARKETS: { key: BacktestMarket; label: string; hint: string }[] = [
	{ key: 'h2h', label: '1X2', hint: 'Végeredmény' },
	{ key: 'ou25', label: 'Gól 2,5', hint: 'Több/kevesebb' }
];

/** football-data liga-kódok → megjelenített név. */
export const LEAGUE_NAMES: Record<string, string> = {
	E0: 'Premier League',
	D1: 'Bundesliga',
	SP1: 'La Liga',
	I1: 'Serie A',
	F1: 'Ligue 1'
};

export const leagueName = (code: string): string => LEAGUE_NAMES[code] ?? code;

/** Szezon kezdőéve → „2023/24”. */
export const seasonLabel = (season: string | number): string => {
	const y = Number(season);
	return Number.isFinite(y) ? `${y}/${String((y + 1) % 100).padStart(2, '0')}` : String(season);
};

const count = (n: number): string => formatDecimal(n, 0);

/** Kompakt oldalfej meta-chipjei: modellverzió, szezon-tartomány, meccsszám, value-küszöb. */
export const evaluationHeadChips = (report: BacktestReport): string[] => {
	const seasons = report.evalSeasons.map(seasonLabel);
	const range = seasons.length > 1 ? `${seasons[0]} ${EN_DASH} ${seasons[seasons.length - 1]}` : seasons[0];
	return [
		`Backtest · ${report.modelVersion}`,
		...(range ? [range] : []),
		`${count(report.matches)} meccs`,
		`value-küszöb: EV ≥ ${formatPercent(report.evThreshold)}`
	];
};

export interface SegmentOption {
	/** `all`, `season:2023`, `league:E0`. */
	key: string;
	label: string;
	group: 'Összes' | 'Szezon' | 'Liga';
}

export const segmentOptions = (report: BacktestReport): SegmentOption[] => [
	{ key: 'all', label: 'Minden szezon és liga', group: 'Összes' },
	...Object.keys(report.bySeason).map((s) => ({ key: `season:${s}`, label: seasonLabel(s), group: 'Szezon' as const })),
	...Object.keys(report.byLeague).map((l) => ({ key: `league:${l}`, label: leagueName(l), group: 'Liga' as const }))
];

/** A kiválasztott szegmens összesítője; ismeretlen kulcsnál az összesített. */
export const selectSegment = (report: BacktestReport, key: string): SegmentSummary => {
	const [kind, id] = key.split(':');
	if (kind === 'season' && report.bySeason[id]) return report.bySeason[id];
	if (kind === 'league' && report.byLeague[id]) return report.byLeague[id];
	return report.overall;
};

// ---------------------------------------------------------------- Sikermutatók (DESIGN §8.4)

export interface GoalRow {
	key: GoalKey;
	label: string;
	sub: string;
	target: string;
	now: string;
	status: GoalStatus;
	pillText: string;
}

const GOAL_META: Record<GoalKey, { label: (m: string) => string; sub: string; target: string }> = {
	brier: { label: (m) => `Brier-pontszám (${m})`, sub: 'a záró piaci baseline-hoz mérve', target: 'modell ≤ piac' },
	logLoss: { label: () => 'Log-loss a záró piachoz', sub: 'magabiztos tévedések büntetése', target: 'modell ≤ piac' },
	calibration: { label: () => 'Kalibráció', sub: 'sávok átlagos eltérése', target: '< 5 pp' },
	clv: { label: () => 'CLV', sub: 'ajánláskori / záró odds − 1', target: '> 0' },
	roi: { label: () => 'ROI flat téttel', sub: 'értelmezhető 300+ tipp után', target: '> 0' }
};

export const GOAL_PILL: Record<GoalStatus, string> = { ok: '✓ Teljesül', fail: '✗ Nem teljesül', info: 'Tájékoztató' };

const goalNow = (g: GoalResult): string => {
	if (g.value === null) return '–';
	switch (g.key) {
		case 'brier':
			return `${formatDecimal(g.model!, 3)} vs ${formatDecimal(g.market!, 3)}`;
		case 'logLoss':
			return `${formatSignedDecimal(g.value, 3)} ${g.value > 0 ? 'rosszabb' : 'jobb'}`;
		case 'calibration':
			return `${formatDecimal(g.value, 1)} pp`;
		case 'clv':
			return formatClv(g.value);
		case 'roi':
			return `${formatEv(g.value)} · ${count(g.n ?? 0)} tipp`;
	}
};

export const goalRows = (goals: readonly GoalResult[], marketLabel: string): GoalRow[] =>
	goals.map((g) => ({
		key: g.key,
		label: GOAL_META[g.key].label(marketLabel),
		sub: GOAL_META[g.key].sub,
		target: GOAL_META[g.key].target,
		now: goalNow(g),
		status: g.status,
		pillText: GOAL_PILL[g.status]
	}));
