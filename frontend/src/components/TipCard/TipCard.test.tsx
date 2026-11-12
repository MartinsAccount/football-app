import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBSP } from '@football/core';
import TipCard from './TipCard';
import { sampleTips } from './sampleTips';
import { barWidth, confidenceText, edgeText, formAriaLabel, formChipTitle, slipToggleText } from './tipView';

const now = new Date('2026-11-12T08:00:00Z');
const [bologna, arsenal] = sampleTips(now);
const noop = () => undefined;

describe('tipView', () => {
	it('labels form chips and rows in Hungarian', () => {
		expect(formAriaLabel('Bologna', bologna.home.last5)).toBe('Bologna utolsó 5: Gy D V Gy D');
		expect(formChipTitle(bologna.home.last5[0])).toBe('Gy vs Lecce 2–0');
		expect(formChipTitle(bologna.home.last5[2])).toBe('V @ Inter 0–1');
		expect(confidenceText('high')).toBe('bizonyosság: magas');
	});

	it('marks only a positive edge as value', () => {
		expect(edgeText(0.61, 0.54)).toEqual({ text: `+7${NBSP}pp érték a javunkra`, positive: true });
		expect(edgeText(0.5, 0.52).positive).toBe(false);
		expect(edgeText(0.5, 0.52).text).toBe(`−2${NBSP}pp a piachoz képest`);
	});

	it('clamps bar width and toggles the slip label', () => {
		expect(barWidth(1.3)).toBe('100%');
		expect(barWidth(0.614)).toBe('61%');
		expect(slipToggleText(true)).toBe('✓ Szelvényen');
		expect(slipToggleText(false)).toBe(`+${NBSP}Szelvényre`);
	});
});

describe('TipCard', () => {
	const render = (props: Partial<React.ComponentProps<typeof TipCard>> = {}) =>
		renderToStaticMarkup(
			<TipCard tip={bologna} selected={false} expanded={false} onToggleSlip={noop} onToggleExpand={noop} now={now} {...props} />
		);

	it('renders the decision fields formatted by core', () => {
		const html = render();
		expect(html).toContain('Bologna – Lazio');
		expect(html).toContain('Gólok száma 2,5 · Alatt');
		expect(html).toContain('1,80');
		expect(html).toContain('+10%');
		expect(html).toContain('61%');
		expect(html).toContain('aria-pressed="false"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).not.toContain('id="tip-details-1001"');
	});

	it('reflects selected, expanded and blocked states', () => {
		const open = render({ selected: true, expanded: true, children: <p>részletek</p> });
		expect(open).toContain('data-selected="true"');
		expect(open).toContain('Részletek elrejtése');
		expect(open).toContain('id="tip-details-1001"');

		const blocked = render({ blockedReason: 'Erről a meccsről már van tipp a szelvényen.' });
		expect(blocked).toContain('disabled=""');
		expect(blocked).toContain('title="Erről a meccsről már van tipp a szelvényen."');
	});

	it('shows data-quality warnings', () => {
		expect(
			renderToStaticMarkup(
				<TipCard tip={arsenal} selected={false} expanded={false} onToggleSlip={noop} onToggleExpand={noop} now={now} />
			)
		).toContain('⚠ A sérültlista 20 órás');
	});
});
