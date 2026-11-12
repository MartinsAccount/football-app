import { expectedValue, MatchResult, minOdds } from '@football/core';
import { Confidence, IFormEntry, ITip } from './tipView';

// Minta-kártyák a TipCard bemutatásához és teszteléséhez, amíg az S18 a valódi predikciókat be nem köti.
// A számok a magból jönnek (EV, min. odds); a csapat- és forma-adat kitalált.

const DAY_MS = 24 * 3600 * 1000;

const form = (now: Date, rows: [MatchResult, string, boolean, number, number][]): IFormEntry[] =>
	rows.map(([result, opponent, home, goalsFor, goalsAgainst], i) => ({
		result,
		opponent,
		home,
		goalsFor,
		goalsAgainst,
		date: new Date(now.getTime() - (rows.length - i) * 7 * DAY_MS)
	}));

const at = (now: Date, hours: number, minutes: number): Date => {
	const d = new Date(now);
	d.setHours(hours, minutes, 0, 0);
	return d;
};

interface ISampleInput {
	id: string;
	league: string;
	kickoff: Date;
	tippmixLabel: string;
	pModel: number;
	pMarket: number;
	odds: number;
	confidence: Confidence;
	warnings?: string[];
}

const tip = (now: Date, input: ISampleInput, rest: Pick<ITip, 'home' | 'away' | 'market' | 'outcome'>): ITip => ({
	id: input.id,
	fixtureId: Number(input.id),
	league: input.league,
	kickoff: input.kickoff,
	tippmixLabel: input.tippmixLabel,
	pModel: input.pModel,
	pMarket: input.pMarket,
	bestOdds: input.odds,
	bookmaker: 'Bet365',
	oddsAt: at(now, 9, 12),
	minOdds: minOdds(input.pModel),
	ev: expectedValue(input.pModel, input.odds),
	confidence: input.confidence,
	warnings: input.warnings ?? [],
	h2h: [],
	modelVersion: 'elo-poisson@0.1.0',
	...rest
});

export const sampleTips = (now: Date = new Date()): ITip[] => [
	tip(
		now,
		{
			id: '1001',
			league: 'Serie A',
			kickoff: at(now, 15, 0),
			tippmixLabel: 'Gólok száma 2,5 · Alatt',
			pModel: 0.61,
			pMarket: 0.54,
			odds: 1.8,
			confidence: 'high'
		},
		{
			market: 'Over/Under 2.5',
			outcome: 'Under',
			home: {
				name: 'Bologna',
				rank: 7,
				points: 18,
				goalDiff: 4,
				stake: 'európai kupahelyért',
				last5: form(now, [
					['W', 'Lecce', true, 2, 0],
					['D', 'Fiorentina', false, 1, 1],
					['L', 'Inter', false, 0, 1],
					['W', 'Cagliari', true, 1, 0],
					['D', 'Torino', true, 0, 0]
				])
			},
			away: {
				name: 'Lazio',
				rank: 6,
				points: 19,
				goalDiff: 6,
				stake: 'európai kupahelyért',
				last5: form(now, [
					['W', 'Genoa', true, 2, 1],
					['D', 'Roma', false, 1, 1],
					['W', 'Empoli', true, 3, 0],
					['L', 'Milan', false, 0, 2],
					['W', 'Monza', true, 1, 0]
				])
			}
		}
	),
	tip(
		now,
		{
			id: '1002',
			league: 'Premier League',
			kickoff: at(now, 18, 30),
			tippmixLabel: 'Végeredmény · 1',
			pModel: 0.52,
			pMarket: 0.46,
			odds: 2.25,
			confidence: 'medium',
			warnings: ['A sérültlista 20 órás']
		},
		{
			market: 'Match Winner',
			outcome: 'Home',
			home: {
				name: 'Arsenal',
				rank: 2,
				last5: form(now, [
					['W', 'Brighton', true, 3, 1],
					['W', 'Fulham', false, 2, 0],
					['D', 'Liverpool', true, 2, 2],
					['W', 'Everton', false, 1, 0],
					['W', 'Wolves', true, 4, 0]
				])
			},
			away: {
				name: 'Chelsea',
				rank: 5,
				last5: form(now, [
					['W', 'Bournemouth', true, 2, 0],
					['L', 'Newcastle', false, 1, 2],
					['W', 'Brentford', true, 2, 1],
					['D', 'Aston Villa', false, 1, 1],
					['L', 'Manchester City', false, 0, 3]
				])
			}
		}
	),
	tip(
		now,
		{
			id: '1003',
			league: 'Bundesliga',
			kickoff: new Date(at(now, 20, 30).getTime() + DAY_MS),
			tippmixLabel: 'Mindkét csapat szerez gólt · Igen',
			pModel: 0.63,
			pMarket: 0.58,
			odds: 1.75,
			confidence: 'low',
			warnings: ['Kevés egymás elleni meccs, a H2H súlya kicsi.']
		},
		{
			market: 'Both Teams Score',
			outcome: 'Yes',
			home: {
				name: 'Borussia Mönchengladbach',
				rank: 11,
				last5: form(now, [
					['L', 'Bayern München', false, 1, 3],
					['D', 'Mainz', true, 2, 2],
					['W', 'Bochum', true, 3, 1],
					['L', 'Freiburg', false, 1, 2],
					['D', 'Augsburg', true, 1, 1]
				])
			},
			away: {
				name: 'Heidenheim',
				rank: 14,
				last5: form(now, [
					['D', 'Köln', true, 1, 1],
					['L', 'Leipzig', false, 0, 2],
					['W', 'Darmstadt', true, 2, 1],
					['L', 'Union Berlin', false, 1, 2],
					['D', 'Werder Bremen', true, 2, 2]
				])
			}
		}
	)
];
