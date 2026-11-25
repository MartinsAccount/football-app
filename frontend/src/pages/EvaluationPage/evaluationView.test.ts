import { describe, expect, it } from 'vitest';
import { BacktestReport, BetSummary, MarketComparison } from '@football/core';
import reportJson from '../../../../data/backtest/backtest-v0.json';
import {
	calibrationRows,
	calibrationSummary,
	evaluationHeadChips,
	goalRows,
	kpis,
	scoreRows,
	seasonLabel,
	segmentOptions,
	segmentRows,
	selectSegment
} from './evaluationView';
import { evaluationVerdict } from '@football/core';

const report = reportJson as unknown as BacktestReport;

const bets = (o: Partial<BetSummary> = {}): BetSummary => ({
	n: 10,
	wins: 4,
	losses: 6,
	voids: 0,
	hitRate: 0.4,
	expectedHitRate: 0.5,
	profit: -1,
	roi: -0.1,
	roiStdError: 0.05,
	meanClv: 0.02,
	clvCount: 10,
	...o
});

const cmp = (model: number, opening: number, closing: number): MarketComparison => ({
	model: { n: 5, meanBrier: 0.6, meanLogLoss: model },
	marketOpening: { n: 5, meanBrier: 0.58, meanLogLoss: opening },
	marketClosing: { n: 5, meanBrier: 0.57, meanLogLoss: closing },
	bets: bets()
});

describe('evaluationView', () => {
	it('oldalfej meta-chipek a riportból', () => {
		const chips = evaluationHeadChips(report);
		expect(chips[0]).toBe('Backtest · ' + report.modelVersion);
		expect(chips).toContain('2023/24 – 2024/25');
		expect(chips.some((c) => /^3\s504 meccs$/.test(c))).toBe(true);
		expect(chips[chips.length - 1]).toBe('value-küszöb: EV ≥ 5%');
	});

	it('szezon-címke', () => {
		expect(seasonLabel('2023')).toBe('2023/24');
		expect(seasonLabel(2099)).toBe('2099/00');
	});

	it('szegmens-opciók és kiválasztás a valódi riportból', () => {
		const opts = segmentOptions(report);
		expect(opts[0].key).toBe('all');
		expect(opts.some((o) => o.key === 'season:2023')).toBe(true);
		expect(opts.find((o) => o.key === 'league:E0')?.label).toBe('Premier League');
		expect(selectSegment(report, 'season:2024')).toBe(report.bySeason['2024']);
		expect(selectSegment(report, 'league:XX')).toBe(report.overall);
		expect(segmentRows(report, 'h2h')).toHaveLength(opts.length - 1);
	});

	it('KPI-k: tónus, sávok, ROI-skála', () => {
		const k = kpis(bets());
		expect([k.hit.tone, k.roi.tone, k.clv.tone]).toEqual(['negative', 'negative', 'positive']);
		expect(k.bets.fill).toBe('40.0%');
		expect(k.hit.foot).toBe('10 pp-tel a modell várakozása alatt');
		expect(k.roi.foot).toBe('95%: −20% … 0%');
		expect(k.roi.ci!.from).toBeLessThan(k.roi.ci!.at);
		expect(k.roi.ci!.to).toBeLessThan(k.roi.ci!.zero);
		const none = kpis(bets({ n: 0, wins: 0, losses: 0, hitRate: null, roi: null, roiStdError: null, meanClv: null }));
		expect([none.roi.value, none.roi.ci, none.clv.value]).toEqual(['–', null, '–']);
	});

	it('sikermutató-sorok a valódi riportból: 2 / 5, pillek', () => {
		const v = evaluationVerdict(report.overall.h2h, report.calibration.h2h);
		const rows = goalRows(v.goals, '1X2');
		expect(rows[0].label).toBe('Brier-pontszám (1X2)');
		expect(rows.map((r) => r.pillText)).toEqual([
			'✗ Nem teljesül',
			'✗ Nem teljesül',
			'✓ Teljesül',
			'✓ Teljesül',
			'✗ Nem teljesül'
		]);
		expect(rows[1].now).toBe('+0,040 rosszabb');
		expect(rows[4].now).toBe('−21% · 2 553 tipp');
	});

	it('pontossági sorok: legjobb, záró = viszonyítási alap', () => {
		const rows = scoreRows(cmp(1.0, 0.96, 0.957));
		expect(rows.map((r) => r.best)).toEqual([false, false, true]);
		expect(rows[0].vsClosing).toBe('+0,043');
		expect(rows[0].tone).toBe('bad');
		expect(rows[2].reference).toBe(true);
		expect(rows[2].vsClosing).toBeNull();
		expect(scoreRows(cmp(0.9, 0.96, 0.957))[0].tone).toBe('good');
	});

	it('kalibrációs sorok, jelzők és értelmezés', () => {
		const buckets = [
			{ lower: 0.1, upper: 0.2, count: 100, meanP: 0.15, hitRate: 0.08 },
			{ lower: 0.2, upper: 0.3, count: 400, meanP: 0.25, hitRate: 0.26 },
			{ lower: 0.5, upper: 0.6, count: 25, meanP: 0.55, hitRate: 0.6 }
		];
		const rows = calibrationRows(buckets);
		expect(rows.map((r) => [r.band, r.deviation, r.flag, r.lowN, r.sample])).toEqual([
			['10–20%', '−7 pp', true, false, '100'],
			['20–30%', '+1 pp', false, false, '400'],
			['50–60%', '+5 pp', false, true, '25*']
		]);
		expect(rows[0].size).toBeCloseTo(8 + 10 / 4.5);
		expect(calibrationSummary(buckets)).toBe(
			'Mérvadó sávok 5 pp-n belül: 1 / 2; túlbecsül: 10–20% (−7 pp). *Nem mérvadó (30 alatti minta): 50–60% (25).'
		);
	});
});
