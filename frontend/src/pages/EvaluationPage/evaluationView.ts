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
	GoalKey,
	GoalResult,
	GoalStatus,
	MarketComparison,
	roiInterval,
	SegmentSummary
} from '@football/core';

/**
 * `/evaluation` nézet-modell a backtest-riportból (`BacktestReport`). Csak formáz: a célok, az ítélet, a ROI-intervallum
 * és a kalibrációs jelzők a core `evaluation/goals.ts` + `verdict.ts`-ből jönnek.
 */

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

const count = (n: number): string => formatDecimal(n, 0);

/** Kompakt oldalfej meta-chipjei (CHANGES 1.): modellverzió, szezon-tartomány, meccsszám, value-küszöb. */
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

const pct = (x: number): string => `${formatDecimal(x, 1).replace(',', '.')}%`;

// ---------------------------------------------------------------- Sikermutatók (DESIGN §8.4)

export interface IGoalRow {
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

export const goalRows = (goals: readonly GoalResult[], marketLabel: string): IGoalRow[] =>
	goals.map((g) => ({
		key: g.key,
		label: GOAL_META[g.key].label(marketLabel),
		sub: GOAL_META[g.key].sub,
		target: GOAL_META[g.key].target,
		now: goalNow(g),
		status: g.status,
		pillText: GOAL_PILL[g.status]
	}));

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
