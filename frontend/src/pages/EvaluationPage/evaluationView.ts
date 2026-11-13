import {
	BacktestMarket,
	BacktestReport,
	BetSummary,
	CalibrationBucket,
	EN_DASH,
	formatDecimal,
	formatEv,
	formatPercent,
	MarketComparison,
	SegmentSummary
} from '@football/core';

/** `/evaluation` nézet-modell a backtest-riportból (`BacktestReport`). Tiszta függvények, a formázás a core-ból. */

export type Tone = 'positive' | 'negative' | 'neutral';

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

/** Kompakt oldalfej meta-chipjei (CHANGES 1.): modellverzió, szezon-tartomány, meccsszám, value-küszöb. */
export const evaluationHeadChips = (report: BacktestReport): string[] => {
	const seasons = report.evalSeasons.map(seasonLabel);
	const range = seasons.length > 1 ? `${seasons[0]} ${EN_DASH} ${seasons[seasons.length - 1]}` : seasons[0];
	return [
		`Backtest · ${report.modelVersion}`,
		...(range ? [range] : []),
		`${formatDecimal(report.matches, 0)} meccs`,
		`value-küszöb: EV ≥ ${formatPercent(report.evThreshold)}`
	];
};

export interface ISegmentOption {
	/** `all`, `season:2023`, `league:E0`. */
	key: string;
	label: string;
	group: 'Összes' | 'Szezon' | 'Liga';
}

export const segmentOptions = (report: BacktestReport): ISegmentOption[] => [
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

const toneOf = (value: number | null, eps = 0): Tone =>
	value === null || Math.abs(value) <= eps ? 'neutral' : value > 0 ? 'positive' : 'negative';

export interface ITile {
	label: string;
	value: string;
	foot: string;
	tone: Tone;
}

/** Kulcsszámok: tippek, találat vs. várt, ROI (±1,96 SE), CLV. */
export const betTiles = (bets: BetSummary): ITile[] => {
	const settled = bets.wins + bets.losses;
	const ci =
		bets.roi !== null && bets.roiStdError !== null
			? `95%: ${formatEv(bets.roi - 1.96 * bets.roiStdError)} … ${formatEv(bets.roi + 1.96 * bets.roiStdError)}`
			: 'kevés tipp a sávhoz';
	return [
		{
			label: 'Value tippek',
			value: String(bets.n),
			foot: `${bets.wins} talált, ${bets.losses} nem${bets.voids ? `, ${bets.voids} void` : ''}`,
			tone: 'neutral'
		},
		{
			label: 'Találati arány',
			value: bets.hitRate === null ? '–' : formatPercent(bets.hitRate),
			foot:
				bets.expectedHitRate === null
					? `${settled} elszámolt tipp`
					: `a modell szerint várt: ${formatPercent(bets.expectedHitRate)}`,
			tone:
				bets.hitRate !== null && bets.expectedHitRate !== null ? toneOf(bets.hitRate - bets.expectedHitRate, 0.005) : 'neutral'
		},
		{
			label: 'ROI (flat 1 egység)',
			value: bets.roi === null ? '–' : formatEv(bets.roi),
			foot: ci,
			tone: toneOf(bets.roi)
		},
		{
			label: 'Átlagos CLV',
			value: bets.meanClv === null ? '–' : `${formatSignedPct(bets.meanClv)}`,
			foot: `${bets.clvCount} tipp záró oddsszal`,
			tone: toneOf(bets.meanClv, 0.0005)
		}
	];
};

/** Arány előjeles %-ban 1 tizedessel (`0.0109` → `+1,1%`). */
export const formatSignedPct = (ratio: number): string => {
	const body = formatDecimal(Math.abs(ratio * 100), 1);
	if (body === '0,0') return '0,0%';
	return `${ratio < 0 ? '−' : '+'}${body}%`;
};

export interface IScoreRow {
	label: string;
	n: number;
	brier: string;
	logLoss: string;
	/** Log-loss eltérés a záró piactól (kisebb = jobb). */
	vsClosing: string;
	tone: Tone;
	best: boolean;
}

const SCORE_ROWS: { key: keyof Omit<MarketComparison, 'bets'>; label: string }[] = [
	{ key: 'model', label: 'Modell' },
	{ key: 'marketOpening', label: 'Nyitó piac' },
	{ key: 'marketClosing', label: 'Záró piac' }
];

/** Brier és log-loss: modell vs. nyitó vs. záró piac (ugyanazokon a meccseken). */
export const scoreRows = (cmp: MarketComparison): IScoreRow[] => {
	const closing = cmp.marketClosing.meanLogLoss;
	const values = SCORE_ROWS.map((r) => cmp[r.key].meanLogLoss).filter((x): x is number => x !== null);
	const best = values.length ? Math.min(...values) : null;
	return SCORE_ROWS.map(({ key, label }) => {
		const s = cmp[key];
		const delta = s.meanLogLoss !== null && closing !== null ? s.meanLogLoss - closing : null;
		return {
			label,
			n: s.n,
			brier: s.meanBrier === null ? '–' : formatDecimal(s.meanBrier, 3),
			logLoss: s.meanLogLoss === null ? '–' : formatDecimal(s.meanLogLoss, 3),
			vsClosing: key === 'marketClosing' || delta === null ? '–' : signedDecimal(delta, 3),
			// A log-loss-nál a kisebb a jobb, ezért a pozitív eltérés rossz.
			tone: key === 'marketClosing' || delta === null ? 'neutral' : toneOf(-delta, 0.0005),
			best: best !== null && s.meanLogLoss === best
		};
	});
};

const signedDecimal = (value: number, decimals: number): string => {
	const body = formatDecimal(Math.abs(value), decimals);
	return Number(body.replace(',', '.')) === 0 ? body : `${value < 0 ? '−' : '+'}${body}`;
};

/** Egymondatos ítélet a modell vs. záró piac log-loss alapján. */
export const verdict = (cmp: MarketComparison): string => {
	const m = cmp.model.meanLogLoss;
	const c = cmp.marketClosing.meanLogLoss;
	if (m === null || c === null) return 'Ehhez a szegmenshez nincs páros piaci összevetés.';
	const d = m - c;
	if (Math.abs(d) < 0.0005) return 'A modell pontossága megegyezik a záró piacéval.';
	return d > 0
		? `A modell pontatlanabb a záró piacnál (log-loss ${signedDecimal(
				d,
				3
		  )}), ezért az ajánlások a piaci valószínűséggel kombinálnak.`
		: `A modell pontosabb a záró piacnál (log-loss ${signedDecimal(d, 3)}).`;
};

export interface ISegmentRow {
	key: string;
	label: string;
	bets: number;
	hitRate: string;
	roi: string;
	roiTone: Tone;
	clv: string;
	clvTone: Tone;
	vsClosing: string;
	vsClosingTone: Tone;
}

/** Szezon- és ligabontás egy piacra (táblázat). */
export const segmentRows = (report: BacktestReport, market: BacktestMarket): ISegmentRow[] => {
	const row = (key: string, label: string, seg: SegmentSummary): ISegmentRow => {
		const { bets, model, marketClosing } = seg[market];
		const d =
			model.meanLogLoss !== null && marketClosing.meanLogLoss !== null ? model.meanLogLoss - marketClosing.meanLogLoss : null;
		return {
			key,
			label,
			bets: bets.n,
			hitRate: bets.hitRate === null ? '–' : formatPercent(bets.hitRate),
			roi: bets.roi === null ? '–' : formatEv(bets.roi),
			roiTone: toneOf(bets.roi),
			clv: bets.meanClv === null ? '–' : formatSignedPct(bets.meanClv),
			clvTone: toneOf(bets.meanClv, 0.0005),
			vsClosing: d === null ? '–' : signedDecimal(d, 3),
			vsClosingTone: d === null ? 'neutral' : toneOf(-d, 0.0005)
		};
	};
	return [
		...Object.entries(report.bySeason).map(([s, seg]) => row(`season:${s}`, seasonLabel(s), seg)),
		...Object.entries(report.byLeague).map(([l, seg]) => row(`league:${l}`, leagueName(l), seg))
	];
};

export interface ICalibrationPoint {
	/** Átlagos becsült p (x). */
	x: number;
	/** Tényleges találati arány (y). */
	y: number;
	count: number;
	/** Pont sugara a mintamérethez (gyök-skála, 0–1). */
	weight: number;
	label: string;
}

/** Kalibrációs pontok a diagramhoz és a szöveges alternatívához. */
export const calibrationPoints = (buckets: readonly CalibrationBucket[]): ICalibrationPoint[] => {
	const max = Math.max(1, ...buckets.map((b) => b.count));
	return buckets.map((b) => ({
		x: b.meanP,
		y: b.hitRate,
		count: b.count,
		weight: Math.sqrt(b.count / max),
		label: `${formatPercent(b.lower)}–${formatPercent(b.upper)}: becsült ${formatPercent(b.meanP)}, tényleges ${formatPercent(
			b.hitRate
		)} (${b.count})`
	}));
};

/** Súlyozott átlagos kalibrációs hiba (|becsült − tényleges|, pp). */
export const calibrationError = (buckets: readonly CalibrationBucket[]): number => {
	const n = buckets.reduce((s, b) => s + b.count, 0);
	return n ? (buckets.reduce((s, b) => s + b.count * Math.abs(b.meanP - b.hitRate), 0) / n) * 100 : 0;
};
