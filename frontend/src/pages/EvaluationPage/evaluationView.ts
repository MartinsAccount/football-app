import {
	BacktestMarket,
	BacktestReport,
	BetSummary,
	CalibrationBucket,
	calibrationDotSize,
	calibrationFlags,
	ciScale,
	CiScale,
	EN_DASH,
	formatClv,
	formatDecimal,
	formatEv,
	formatPercent,
	formatPp,
	formatSignedDecimal,
	leagueName,
	MarketComparison,
	roiInterval,
	seasonLabel,
	SegmentSummary
} from '@football/core';

/**
 * `/evaluation` nézet-modell a backtest-riportból (`BacktestReport`). Csak formáz: a célok, az ítélet, a ROI-intervallum
 * és a kalibrációs jelzők a core `evaluation/goals.ts` + `verdict.ts`-ből jönnek.
 */

export type Tone = 'positive' | 'negative' | 'neutral';

export {
	EVAL_MARKETS,
	evaluationHeadChips,
	GOAL_PILL,
	goalRows,
	LEAGUE_NAMES,
	leagueName,
	seasonLabel,
	segmentOptions,
	selectSegment
} from '@football/core';
export type { GoalRow as IGoalRow, SegmentOption as ISegmentOption } from '@football/core';

const count = (n: number): string => formatDecimal(n, 0);

const toneOf = (value: number | null, eps = 0): Tone =>
	value === null || Math.abs(value) <= eps ? 'neutral' : value > 0 ? 'positive' : 'negative';

const pct = (x: number): string => `${formatDecimal(x, 1).replace(',', '.')}%`;

// ---------------------------------------------------------------- KPI-k

export interface IKpis {
	bets: { value: string; fill: string; foot: string };
	hit: { value: string; expected: string | null; tone: Tone; fill: string; ref: string | null; foot: string; aria: string };
	/** `ci` = `null`, ha nincs standard hiba (kevés tipp). */
	roi: { value: string; tone: Tone; ci: (CiScale & { lower: string; upper: string }) | null; foot: string; aria: string };
	clv: { value: string; tone: Tone; foot: string };
}

/** Value tippek (talált/nem sáv), találati arány a várthoz, ROI 95%-os sávval a nullához, CLV. */
export const kpis = (b: BetSummary): IKpis => {
	const settled = b.wins + b.losses;
	const hitDiff = b.hitRate !== null && b.expectedHitRate !== null ? (b.hitRate - b.expectedHitRate) * 100 : null;
	const ciRaw = b.roi !== null && b.roiStdError !== null ? roiInterval(b.roi, b.roiStdError) : null;
	const scale = ciRaw && b.roi !== null ? ciScale(ciRaw, b.roi) : null;
	const roiText = b.roi === null ? '–' : formatEv(b.roi);
	return {
		bets: {
			value: count(b.n),
			fill: pct(settled ? (b.wins / settled) * 100 : 0),
			foot: `${count(b.wins)} talált · ${count(b.losses)} nem${b.voids ? ` · ${count(b.voids)} void` : ''}`
		},
		hit: {
			value: b.hitRate === null ? '–' : formatPercent(b.hitRate),
			expected: b.expectedHitRate === null ? null : `várt: ${formatPercent(b.expectedHitRate)}`,
			tone: toneOf(hitDiff, 0.5),
			fill: pct((b.hitRate ?? 0) * 100),
			ref: b.expectedHitRate === null ? null : pct(b.expectedHitRate * 100),
			foot:
				hitDiff === null
					? `${count(settled)} elszámolt tipp`
					: Math.abs(hitDiff) < 0.5
					? 'a modell várakozásának megfelelően'
					: `${formatPp(Math.abs(hitDiff)).replace('+', '')}-tel a modell várakozása ${hitDiff < 0 ? 'alatt' : 'felett'}`,
			aria:
				b.hitRate === null
					? 'Nincs elszámolt tipp'
					: `Tényleges ${formatPercent(b.hitRate)}${
							b.expectedHitRate === null ? '' : `, a modell szerint várt ${formatPercent(b.expectedHitRate)}`
					  }`
		},
		roi: {
			value: roiText,
			tone: toneOf(b.roi),
			ci:
				ciRaw && scale
					? {
							from: scale.from,
							to: scale.to,
							at: scale.at,
							zero: scale.zero,
							lower: formatEv(ciRaw.lower),
							upper: formatEv(ciRaw.upper)
					  }
					: null,
			foot: ciRaw ? `95%: ${formatEv(ciRaw.lower)} … ${formatEv(ciRaw.upper)}` : 'kevés tipp a sávhoz',
			aria: ciRaw
				? `ROI ${roiText}, 95%-os intervallum ${formatEv(ciRaw.lower)} és ${formatEv(ciRaw.upper)} között, ${
						ciRaw.upper < 0 ? 'a nullától balra' : ciRaw.lower > 0 ? 'a nullától jobbra' : 'a nullát átfedve'
				  }`
				: `ROI ${roiText}`
		},
		clv: {
			value: b.meanClv === null ? '–' : formatClv(b.meanClv),
			tone: toneOf(b.meanClv, 0.0005),
			foot:
				b.meanClv === null
					? 'nincs záró odds a tippekhez'
					: `${count(b.clvCount)} tipp a záró oddshoz mérve. ${
							b.meanClv > 0
								? 'Pozitív: az ajánláskori odds átlagosan jobb volt a zárónál.'
								: 'Nem pozitív: az ajánláskori odds átlagosan nem volt jobb a zárónál.'
					  }`
		}
	};
};

// ---------------------------------------------------------------- Pontosság

export interface IScoreRow {
	label: string;
	n: string;
	brier: string;
	logLoss: string;
	/** Log-loss eltérés a záró piactól (kisebb = jobb); a záró sorban `null` (viszonyítási alap). */
	vsClosing: string | null;
	tone: 'good' | 'bad' | undefined;
	best: boolean;
	reference: boolean;
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
		const reference = key === 'marketClosing';
		const delta = !reference && s.meanLogLoss !== null && closing !== null ? s.meanLogLoss - closing : null;
		return {
			label,
			n: count(s.n),
			brier: s.meanBrier === null ? '–' : formatDecimal(s.meanBrier, 3),
			logLoss: s.meanLogLoss === null ? '–' : formatDecimal(s.meanLogLoss, 3),
			vsClosing: reference ? null : delta === null ? '–' : formatSignedDecimal(delta, 3),
			// A log-loss-nál a kisebb a jobb, ezért a pozitív eltérés rossz.
			tone: delta === null || Math.abs(delta) < 0.0005 ? undefined : delta > 0 ? 'bad' : 'good',
			best: best !== null && s.meanLogLoss === best,
			reference
		};
	});
};

// ---------------------------------------------------------------- Bontás

export interface ISegmentRow {
	key: string;
	label: string;
	bets: string;
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
			bets: count(bets.n),
			hitRate: bets.hitRate === null ? '–' : formatPercent(bets.hitRate),
			roi: bets.roi === null ? '–' : formatEv(bets.roi),
			roiTone: toneOf(bets.roi),
			clv: bets.meanClv === null ? '–' : formatClv(bets.meanClv),
			clvTone: toneOf(bets.meanClv, 0.0005),
			vsClosing: d === null ? '–' : formatSignedDecimal(d, 3),
			vsClosingTone: d === null ? 'neutral' : toneOf(-d, 0.0005)
		};
	};
	return [
		...Object.entries(report.bySeason).map(([s, seg]) => row(`season:${s}`, seasonLabel(s), seg)),
		...Object.entries(report.byLeague).map(([l, seg]) => row(`league:${l}`, leagueName(l), seg))
	];
};

// ---------------------------------------------------------------- Kalibráció

export interface ICalibrationRow {
	key: string;
	band: string;
	estimated: string;
	actual: string;
	deviation: string;
	sample: string;
	flag: boolean;
	lowN: boolean;
	/** A grafikon pozíciói (%) és a pont átmérője (px). */
	x: number;
	y: number;
	size: number;
	title: string;
}

const bandLabel = (b: CalibrationBucket): string =>
	`${formatDecimal(b.lower * 100, 0)}${EN_DASH}${formatDecimal(b.upper * 100, 0)}%`;

export const calibrationRows = (buckets: readonly CalibrationBucket[]): ICalibrationRow[] =>
	buckets.map((b) => {
		const f = calibrationFlags(b);
		const band = bandLabel(b);
		return {
			key: String(b.lower),
			band,
			estimated: formatPercent(b.meanP),
			actual: formatPercent(b.hitRate),
			deviation: formatPp(f.deviationPp),
			sample: `${count(b.count)}${f.lowN ? '*' : ''}`,
			flag: f.flag,
			lowN: f.lowN,
			x: b.meanP * 100,
			y: b.hitRate * 100,
			size: calibrationDotSize(b.count),
			title: `${band}: becsült ${formatPercent(b.meanP)}, tényleges ${formatPercent(b.hitRate)} (${count(b.count)})`
		};
	});

/** Egy mondatos értelmezés a jelzőkből: hol becsül túl/alá ≥ 5 pp-vel, és melyik sáv nem mérvadó. */
export const calibrationSummary = (buckets: readonly CalibrationBucket[]): string => {
	const rows = calibrationRows(buckets);
	const list = (rs: ICalibrationRow[]) => rs.map((r) => `${r.band} (${r.deviation})`).join(', ');
	const over = rows.filter((r) => r.flag && r.y < r.x);
	const under = rows.filter((r) => r.flag && r.y > r.x);
	const low = rows.filter((r) => r.lowN);
	const sure = rows.length - low.length;
	const within = sure - over.length - under.length;
	const main = !sure
		? 'Nincs mérvadó (legalább 30 mintás) sáv.'
		: [
				`Mérvadó sávok 5 pp-n belül: ${within} / ${sure}`,
				...(over.length ? [`túlbecsül: ${list(over)}`] : []),
				...(under.length ? [`alábecsül: ${list(under)}`] : [])
		  ].join('; ') + '.';
	const lowText = low.length
		? ` *Nem mérvadó (30 alatti minta): ${low.map((r) => `${r.band} (${r.sample.replace('*', '')})`).join(', ')}.`
		: '';
	return `${main}${lowText}`;
};

export const calibrationAria = (marketLabel: string, buckets: readonly CalibrationBucket[], errorPp: number): string =>
	`Kalibrációs görbe, ${marketLabel}: a becsült és a tényleges arány ${buckets.length} sávban, átlagos eltérés ${formatDecimal(
		errorPp,
		1
	)} pp`;
