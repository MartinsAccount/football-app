import { describe, expect, it } from 'vitest';
import { BacktestReport, BetSummary, MarketComparison } from '@football/core';
import reportJson from '../../../../data/backtest/backtest-v0.json';
import {
	betTiles,
	calibrationError,
	calibrationPoints,
	formatSignedPct,
	scoreRows,
	seasonLabel,
	segmentOptions,
	segmentRows,
	selectSegment,
	verdict
} from './evaluationView';

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
	it('szezon-címke és előjeles %', () => {
		expect(seasonLabel('2023')).toBe('2023/24');
		expect(seasonLabel(2099)).toBe('2099/00');
		expect(formatSignedPct(0.0109)).toBe('+1,1%');
		expect(formatSignedPct(-0.0116)).toBe('−1,2%');
		expect(formatSignedPct(0.0001)).toBe('0,0%');
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

	it('tipp-csempék: tónus és CI', () => {
		const tiles = betTiles(bets());
		expect(tiles.map((t) => t.tone)).toEqual(['neutral', 'negative', 'negative', 'positive']);
		expect(tiles[2].foot).toMatch(/^95%: /);
		expect(betTiles(bets({ n: 0, hitRate: null, roi: null, roiStdError: null, meanClv: null }))[2].value).toBe('–');
	});

	it('pontossági sorok: legjobb és záróhoz mért eltérés', () => {
		const rows = scoreRows(cmp(1.0, 0.96, 0.957));
		expect(rows.map((r) => r.best)).toEqual([false, false, true]);
		expect(rows[0].vsClosing).toBe('+0,043');
		expect(rows[0].tone).toBe('negative');
		expect(rows[2].vsClosing).toBe('–');
		expect(verdict(cmp(1.0, 0.96, 0.957))).toMatch(/pontatlanabb/);
		expect(verdict(cmp(0.9, 0.96, 0.957))).toMatch(/pontosabb/);
	});

	it('kalibrációs pontok és súlyozott hiba', () => {
		const buckets = [
			{ lower: 0.1, upper: 0.2, count: 100, meanP: 0.15, hitRate: 0.1 },
			{ lower: 0.5, upper: 0.6, count: 25, meanP: 0.55, hitRate: 0.6 }
		];
		const pts = calibrationPoints(buckets);
		expect(pts[0].weight).toBe(1);
		expect(pts[1].weight).toBeCloseTo(0.5);
		expect(calibrationError(buckets)).toBeCloseTo(5);
		expect(calibrationError([])).toBe(0);
	});
});
