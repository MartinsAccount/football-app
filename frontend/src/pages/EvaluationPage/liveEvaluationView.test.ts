import { describe, expect, it } from 'vitest';
import { EvaluationRecord, summarizeEvaluations } from '@football/core';
import { liveChips, liveMarketRows, modelOptions } from './liveEvaluationView';

const rec = (o: Partial<EvaluationRecord> = {}): EvaluationRecord => ({
	runId: 1,
	fixtureId: 10,
	marketId: 1,
	selection: 'Home',
	line: null,
	modelVersion: 'elo@1',
	isRecommendation: true,
	pModel: 0.5,
	odd: 2.2,
	outcome: 'win',
	brier: 0.4,
	logLoss: 0.69,
	closingOdd: null,
	...o
});

describe('liveEvaluationView', () => {
	it('üres összesítés: csak az összesítő sor, kötőjelekkel', () => {
		const s = summarizeEvaluations([]);
		expect(modelOptions(s)).toEqual([{ value: '', label: 'Minden verzió' }]);
		expect(liveMarketRows(s)).toEqual([
			expect.objectContaining({ key: 'all', groups: '0', brier: '–', logLoss: '–', bets: '0', roi: '–', total: true })
		]);
	});

	it('piaconkénti sorok magyar piacnévvel és formázott számokkal', () => {
		const s = summarizeEvaluations([
			rec(),
			rec({ marketId: 5, line: 2.5, selection: 'Over', outcome: 'loss', brier: 0.3, logLoss: 0.5, modelVersion: 'elo@2' })
		]);
		expect(modelOptions(s).map((o) => o.value)).toEqual(['', 'elo@1', 'elo@2']);
		expect(liveChips(s)).toEqual(['2 kiértékelt predikció', '2 piac-csoport']);
		const rows = liveMarketRows(s);
		expect(rows.map((r) => r.label)).toEqual(['Végeredmény', 'Gólszám', 'Összesen']);
		expect(rows[0]).toMatchObject({ brier: '0,400', roi: '+120%', roiTone: 'positive' });
		expect(rows[1]).toMatchObject({ roiTone: 'negative' });
		expect(rows[2]).toMatchObject({ brier: '0,350', bets: '2' });
	});
});
