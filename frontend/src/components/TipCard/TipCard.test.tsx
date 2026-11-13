import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBSP } from '@football/core';
import TipCard from './TipCard';
import { sampleTips } from './sampleTips';
import {
	barWidth,
	confidenceText,
	formAriaLabel,
	formChipTitle,
	probabilityAriaLabel,
	slipToggleText,
	tipMarketParts
} from './tipView';

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

	it('splits the market and the outcome badge, and reads the probability bar', () => {
		expect(tipMarketParts('Végeredmény · 2', 'Away')).toEqual({ market: 'Végeredmény', badge: '2 · vendég' });
		expect(tipMarketParts('Végeredmény · X', 'Draw')).toEqual({ market: 'Végeredmény', badge: 'X · döntetlen' });
		expect(tipMarketParts('Gólok száma 2,5 · Alatt', 'Under')).toEqual({ market: 'Gólok száma 2,5', badge: 'Alatt' });
		expect(tipMarketParts('Egyéb', 'Yes')).toEqual({ market: 'Egyéb', badge: 'Yes' });
		expect(probabilityAriaLabel(0.36, 0.33)).toBe('Szerintünk 36%, irodák szerint 33%');
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

	it('renders the head, the decision tiles and the actions in reference order', () => {
		const html = render();
		expect(html).toContain('Bologna – Lazio');
		expect(html).toContain('Gólok száma 2,5 <span class="oe-badge">Alatt</span>');
		expect(html).toContain('<div class="oe-tip__ev-value">+10%</div>');
		expect(html).toContain('<div class="oe-tile__value">1,80</div>');
		expect(html).toContain('ennél rosszabbra ne');
		expect(html).toContain('style="--p:61%;--m:54%" role="img" aria-label="Szerintünk 61%, irodák szerint 54%"');
		expect(html).toContain('aria-pressed="false"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain('Indoklás, tabella, egymás ellen');
		// Csukva a részletek `hidden`, de az aria-controls célja létezik.
		expect(html).toContain('id="tip-details-1001" hidden=""');
		// „Miért?” csipek nincsenek (nincs strukturált pp-adat).
		expect(html).not.toContain('oe-why');
		const order = ['oe-tip__head', 'oe-decision', 'oe-teams', 'oe-tip__actions', 'oe-tip__details'].map((c) => html.indexOf(c));
		expect(order).toEqual([...order].sort((a, b) => a - b));
	});

	it('reflects selected, expanded and blocked states', () => {
		const open = render({ selected: true, expanded: true, children: <p>részletek</p> });
		expect(open).toContain('data-selected="true"');
		expect(open).toContain('Részletek elrejtése');
		expect(open).toContain('id="tip-details-1001">');
		expect(open).toContain('<p>részletek</p>');
		expect(open).toMatch(/oe-tip__source">Forrás: .* · elo-poisson/);

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
