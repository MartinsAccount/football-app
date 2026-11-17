import { describe, expect, it } from 'vitest';
import { drawRows, drawSubtitle, type DrawWatchViewInput } from './drawWatchView';

const res: DrawWatchViewInput = {
	modelVersion: 'draw-logreg@1.0.0',
	analyzed: 40,
	items: [
		{
			fixtureId: 7,
			league: { name: 'Serie A' },
			kickoff: '2025-04-12T13:00:00.000Z',
			home: { name: 'Fiorentina' },
			away: { name: 'Parma' },
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
			league: { name: 'Premier League' },
			kickoff: '2025-04-13T15:00:00.000Z',
			home: { name: 'A' },
			away: { name: 'B' },
			pDraw: 0.3,
			pMarket: 0.29,
			drawOdds: null,
			factors: []
		}
	]
};

describe('drawWatchView', () => {
	it('sorok magyar formázással, szöveges irány-címkével', () => {
		const [a, b] = drawRows(res, new Date('2025-04-12T07:00:00Z'));
		expect(a).toEqual({
			id: 7,
			title: 'Fiorentina – Parma',
			meta: 'Serie A · ma 15:00',
			pDraw: '32%',
			market: 'piac 25% · X 3,90',
			factors: [
				{
					key: 'elo',
					label: 'Erőkülönbség (Elo): emeli',
					direction: 'up',
					detail: 'erőkülönbség: 210 Elo-pont',
					aria: 'Erőkülönbség (Elo) emeli a döntetlen-esélyt: erőkülönbség: 210 Elo-pont'
				},
				{
					key: 'goals',
					label: 'Várható gólszám: csökkenti',
					direction: 'down',
					detail: 'várható gólszám 2,31 (kevés gól)',
					aria: 'Várható gólszám csökkenti a döntetlen-esélyt: várható gólszám 2,31 (kevés gól)'
				}
			]
		});
		expect(b.market).toBe('piac 29%');
		expect(b.meta).toBe('Premier League · holnap 17:00');
	});

	it('alcím', () => {
		expect(drawSubtitle(res)).toBe('40 meccsből top 2 · p(X) szerint');
	});
});
