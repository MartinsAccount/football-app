import { describe, expect, it } from 'vitest';
import type { BacktestReport, SegmentSummary } from '../backtest/backtest';
import { NBSP } from '../format/format';
import type { GoalResult } from './goals';
import { evaluationHeadChips, goalRows, leagueName, seasonLabel, segmentOptions, selectSegment } from './labels';

const seg = (tag: number) => ({ tag } as unknown as SegmentSummary);
const report = {
	modelVersion: 'elo-poisson@0.1.0',
	evalSeasons: [2023, 2024],
	evThreshold: 0.05,
	matches: 3504,
	overall: seg(0),
	bySeason: { '2023': seg(1), '2024': seg(2) },
	byLeague: { E0: seg(3), XX: seg(4) },
	calibration: { h2h: [], ou25: [] }
} as unknown as BacktestReport;

describe('evaluation labels', () => {
	it('szezon- és liganév', () => {
		expect(seasonLabel('2023')).toBe('2023/24');
		expect(seasonLabel(2099)).toBe('2099/00');
		expect(seasonLabel('x')).toBe('x');
		expect(leagueName('E0')).toBe('Premier League');
		expect(leagueName('XX')).toBe('XX');
	});

	it('oldalfej-chipek', () => {
		expect(evaluationHeadChips(report)).toEqual([
			'Backtest · elo-poisson@0.1.0',
			'2023/24 – 2024/25',
			`3${NBSP}504 meccs`,
			'value-küszöb: EV ≥ 5%'
		]);
		expect(evaluationHeadChips({ ...report, evalSeasons: [] })).toHaveLength(3);
	});

	it('szegmensek és kiválasztás', () => {
		expect(segmentOptions(report).map((o) => o.key)).toEqual(['all', 'season:2023', 'season:2024', 'league:E0', 'league:XX']);
		expect(selectSegment(report, 'season:2024')).toBe(report.bySeason['2024']);
		expect(selectSegment(report, 'league:E0')).toBe(report.byLeague.E0);
		expect(selectSegment(report, 'league:ZZ')).toBe(report.overall);
		expect(selectSegment(report, 'all')).toBe(report.overall);
	});

	it('sikermutató-sorok', () => {
		const goals: GoalResult[] = [
			{ key: 'brier', status: 'fail', value: 0.027, model: 0.595, market: 0.568 },
			{ key: 'calibration', status: 'ok', value: 3.24 },
			{ key: 'clv', status: 'ok', value: 0.011, n: 10 },
			{ key: 'roi', status: 'info', value: null }
		];
		const rows = goalRows(goals, 'Gól 2,5');
		expect(rows[0].label).toBe('Brier-pontszám (Gól 2,5)');
		expect(rows.map((r) => r.now)).toEqual(['0,595 vs 0,568', '3,2 pp', '+1,1%', '–']);
		expect(rows.map((r) => r.pillText)).toEqual(['✗ Nem teljesül', '✓ Teljesül', '✓ Teljesül', 'Tájékoztató']);
	});
});
