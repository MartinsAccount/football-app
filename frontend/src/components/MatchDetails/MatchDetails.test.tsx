import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleTips } from '../TipCard/sampleTips';
import MatchDetails from './MatchDetails';
import { h2hRows, h2hSummary, recentRows, recentSummary, stripAriaLabel, stripCells, teamTableLine } from './matchDetailsView';

const now = new Date('2026-11-12T08:00:00Z');
const [bologna, arsenal, gladbach] = sampleTips(now);
const M = '−';

describe('matchDetailsView', () => {
	it('builds the league strip with zones and both teams marked', () => {
		const cells = stripCells(20, 7, 6);
		expect(cells).toHaveLength(20);
		expect(cells.slice(0, 7)).toEqual(['cl', 'cl', 'cl', 'cl', 'eu', 'away', 'home']);
		expect(cells.slice(17)).toEqual(['rel', 'rel', 'rel']);
		expect(cells.filter((c) => c === 'mid')).toHaveLength(10);
		expect(stripCells(18).slice(15)).toEqual(['rel', 'rel', 'rel']);
		expect(stripAriaLabel(bologna.home, bologna.away, 20)).toBe('Bologna 7., Lazio 6. a 20-ból');
	});

	it('writes the table line and skips missing fields', () => {
		expect(teamTableLine(bologna.home)).toBe('7. Bologna · 18 pont · gólkül. +4');
		expect(teamTableLine({ ...bologna.home, goalDiff: -3 })).toBe(`7. Bologna · 18 pont · gólkül. ${M}3`);
		expect(teamTableLine(arsenal.home)).toBe('2. Arsenal');
	});

	it('summarises H2H from the current home side, latest first', () => {
		const rows = h2hRows(bologna.h2h);
		expect(rows[0].date.getTime()).toBeGreaterThan(rows[1].date.getTime());
		expect(rows[0].homeName).toBe('Lazio');
		expect(h2hSummary('Bologna', rows)).toBe('Bologna szemszögéből: 1 Gy · 3 D · 1 V · átl. 1,8 gól · 4/5 meccs 2,5 alatt');
		expect(h2hRows([...arsenal.h2h, ...arsenal.h2h, ...arsenal.h2h])).toHaveLength(5);
	});

	it('lists the last 5 latest first with a summary', () => {
		const rows = recentRows(bologna.home.last5);
		expect(rows[0].opponent).toBe('Torino');
		expect(rows[4].opponent).toBe('Lecce');
		expect(recentSummary(rows)).toBe('2 Gy · 2 D · 1 V · átl. 1,2 gól/meccs');
	});
});

describe('MatchDetails', () => {
	it('renders the four blocks and the legend', () => {
		const html = renderToStaticMarkup(<MatchDetails tip={bologna} />);
		expect(html).toContain('Tabella · Serie A');
		expect(html).toContain('Egymás ellen · utolsó 5');
		expect(html).toContain('Bologna · utolsó 5');
		expect(html).toContain('Lazio · utolsó 5');
		expect(html).toContain('Tét: európai kupahelyért');
		expect(html.match(/<span class="oe-strip__cell/g)).toHaveLength(20);
		expect(html).toContain('„vs” = otthon');
		expect(html).not.toContain('Kevés egymás elleni meccs');
	});

	it('warns when there are fewer than 4 H2H matches and uses the league size', () => {
		const html = renderToStaticMarkup(<MatchDetails tip={gladbach} />);
		expect(html).toContain('Egymás ellen · utolsó 2');
		expect(html).toContain('Kevés egymás elleni meccs, a H2H súlya kicsi.');
		expect(html).toContain('1.–18. hely');
	});
});
