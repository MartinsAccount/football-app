import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { sampleTips } from '../TipCard/sampleTips';
import { memorySlipStorage, SlipStore } from '../../stores/SlipStore';
import SlipPresets from './SlipPresets';

const now = new Date('2026-11-12T08:00:00Z');
const tips = sampleTips(now);

describe('SlipPresets', () => {
	it('renders the engine presets with one recommended and marks the applied one', () => {
		const store = new SlipStore(memorySlipStorage());
		let html = renderToStaticMarkup(<SlipPresets tips={tips} store={store} />);
		expect(html).toContain('Kész szelvények');
		expect(html).toContain('Szingli');
		expect(html).toContain('Dupla kötés');
		expect(html.match(/Ajánlott/g)).toHaveLength(1);
		expect(html).not.toContain('A szelvényeden');

		const best = [...tips].filter((t) => t.ev > 0).sort((x, y) => y.ev - x.ev)[0];
		store.applyPreset([best]);
		html = renderToStaticMarkup(<SlipPresets tips={tips} store={store} />);
		expect(html).toContain('A szelvényeden');
	});

	it('renders nothing without positive-EV tips', () => {
		const store = new SlipStore(memorySlipStorage());
		expect(renderToStaticMarkup(<SlipPresets tips={[]} store={store} />)).toBe('');
	});
});
