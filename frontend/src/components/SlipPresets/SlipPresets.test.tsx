import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleTips } from '../TipCard/sampleTips';
import { memorySlipStorage, SlipStore } from '../../stores/SlipStore';
import SlipPresets from './SlipPresets';

const now = new Date('2026-11-12T08:00:00Z');
const tips = sampleTips(now);

describe('SlipPresets', () => {
	it('renders the §8.2 presets: label, names, at most one „Ajánlott”, metrics and risk dot', () => {
		const store = new SlipStore(memorySlipStorage());
		const html = renderToStaticMarkup(<SlipPresets tips={tips} store={store} />);
		expect(html).toContain('Kész szelvények');
		expect(html).toContain('Szingli · ');
		expect(html).toContain('Dupla kötés · ');
		expect((html.match(/class="oe-preset"/g) ?? []).length).toBeLessThanOrEqual(3);
		expect((html.match(/Ajánlott/g) ?? []).length).toBeLessThanOrEqual(1);
		expect(html).toContain('oe-preset__legs');
		expect(html).toMatch(/oe-risk-dot" data-level="(low|medium|high)"/);
		expect(html).toContain('ilyen szelvény nyer.');
	});

	it('renders nothing without positive-EV tips', () => {
		const store = new SlipStore(memorySlipStorage());
		expect(renderToStaticMarkup(<SlipPresets tips={[]} store={store} />)).toBe('');
	});
});
