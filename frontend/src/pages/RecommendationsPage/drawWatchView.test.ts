import type { DrawsResponse } from '@football/contract';
import { drawRows, drawSubtitle } from './drawWatchView';

const res: DrawsResponse = {
	modelVersion: 'draw-logreg@1.0.0',
	from: '2025-04-12T07:00:00.000Z',
	to: '2025-04-14T07:00:00.000Z',
	analyzed: 40,
	items: [
		{
			fixtureId: 7,
			league: { id: 135, name: 'Serie A' },
			kickoff: '2025-04-12T13:00:00.000Z',
			home: { id: 1, name: 'Fiorentina' },
			away: { id: 2, name: 'Parma' },
			pDraw: 0.324,
			pMarket: 0.254,
			drawOdds: 3.9,
			factors: [
				{ key: 'elo', label: 'Erőkülönbség (Elo)', detail: 'erőkülönbség: 210 Elo-pont', contribution: 0.43 },
				{ key: 'goals', label: 'Várható gólszám', detail: 'várható gólszám 2,31 (kevés gól)', contribution: -0.03 }
			]
		},
		{
			fixtureId: 8,
			league: { id: 39, name: 'Premier League' },
			kickoff: '2025-04-13T15:00:00.000Z',
			home: { id: 3, name: 'A' },
			away: { id: 4, name: 'B' },
			pDraw: 0.3,
			pMarket: 0.29,
			drawOdds: null,
			factors: []
		}
	]
};

describe('drawWatchView', () => {
	it('sorok magyar formázással, irány-nyíllal', () => {
		const [a, b] = drawRows(res, new Date('2025-04-12T07:00:00Z'));
		expect(a).toEqual({
			id: 7,
			title: 'Fiorentina – Parma',
			meta: 'Serie A · ma 15:00',
			pDraw: '32%',
			market: 'piac 25% · X 3,90',
			factors: [
				{ key: 'elo', label: '↑ Erőkülönbség (Elo)', detail: 'erőkülönbség: 210 Elo-pont' },
				{ key: 'goals', label: '↓ Várható gólszám', detail: 'várható gólszám 2,31 (kevés gól)' }
			]
		});
		expect(b.market).toBe('piac 29%');
		expect(b.meta).toBe('Premier League · holnap 17:00');
	});

	it('alcím', () => {
		expect(drawSubtitle(res)).toBe('40 meccsből top 2 · p(X) szerint');
	});
});
