import { DEFAULT_RECOMMENDATION_RULES, RecommendationItem, RecommendationSnapshot } from '@football/core';
import snapshotJson from '../../../../data/recommendations/recommendations-v0.json';
import { groupTipsByDay, toTip } from './recommendationsView';

const item = (fixtureId: number, kickoff: string, outcome: RecommendationItem['outcome'] = 'Home'): RecommendationItem => ({
	fixtureId,
	league: 'Premier League',
	leagueSize: 20,
	kickoff,
	market: outcome === 'Over' || outcome === 'Under' ? 'ou25' : 'h2h',
	outcome,
	pModel: 0.5,
	pModelRaw: 0.55,
	pMarket: 0.46,
	bestOdds: 2.25,
	bookmaker: 'Pinnacle',
	bookmakers: 4,
	oddsAt: '2025-04-11T14:00:00.000Z',
	minOdds: 2.1,
	ev: 0.125,
	confidence: 'medium',
	warnings: [],
	reasons: ['Hazai pálya.'],
	stakeUnits: 1,
	modelVersion: 'elo-poisson@0.1.0',
	home: {
		name: 'Arsenal',
		last5: [{ result: 'W', opponent: 'Fulham', home: true, goalsFor: 2, goalsAgainst: 0, date: '2025-04-01T19:00:00Z' }]
	},
	away: { name: 'Chelsea', last5: [] },
	h2h: []
});

const snapshot = (items: RecommendationItem[]): RecommendationSnapshot => ({
	modelVersion: 'elo-poisson@0.1.0',
	now: '2025-04-12T07:00:00.000Z',
	source: 'teszt',
	rules: DEFAULT_RECOMMENDATION_RULES,
	analyzed: items.length,
	items
});

describe('recommendationsView', () => {
	it('maps a snapshot item to a TipCard view model', () => {
		const tip = toTip(item(7, '2025-04-12T14:00:00.000Z', 'Under'));
		expect(tip.id).toBe('7');
		expect(tip.tippmixLabel).toBe('Gólok száma 2,5 · Alatt');
		expect(tip.kickoff).toEqual(new Date('2025-04-12T14:00:00.000Z'));
		expect(tip.home.last5[0].date).toBeInstanceOf(Date);
		expect(tip.stakeUnits).toBe(1);
	});

	it('groups by Budapest day relative to the snapshot "now", sorted by kickoff', () => {
		const days = groupTipsByDay(
			snapshot([
				item(1, '2025-04-12T18:30:00.000Z'),
				item(2, '2025-04-12T11:30:00.000Z'),
				// 23:30 UTC = vasárnap 01:30 Budapesten
				item(3, '2025-04-12T23:30:00.000Z'),
				item(4, '2025-04-15T18:00:00.000Z')
			])
		);
		expect(days.map((d) => [d.title, d.tips.map((t) => t.id)])).toEqual([
			['Ma', ['2', '1']],
			['Holnap', ['3']]
		]);
	});

	it('reads the generated snapshot', () => {
		const s = snapshotJson as RecommendationSnapshot;
		expect(s.analyzed).toBeGreaterThan(0);
		for (const i of s.items) {
			expect(i.ev).toBeGreaterThanOrEqual(s.rules.evThreshold);
			expect(i.pModel - i.pMarket).toBeGreaterThanOrEqual(s.rules.minEdge);
		}
	});
});
