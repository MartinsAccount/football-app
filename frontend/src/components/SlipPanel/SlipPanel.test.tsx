import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NBSP, summarizeSlip } from '@football/core';
import { sampleTips } from '../TipCard/sampleTips';
import { memorySlipStorage, SlipStore } from '../../stores/SlipStore';
import SlipPanel from './SlipPanel';
import { riskText, singlesNote, slipHeadText } from './slipView';

const now = new Date('2026-11-12T08:00:00Z');
const [a, b] = sampleTips(now);

describe('slipView', () => {
	it('writes the head, risk and singles texts in Hungarian', () => {
		expect(slipHeadText(2)).toBe('Dupla kötés · 2 tipp');
		expect(riskText(0.39, 'low')).toBe('Alacsony kockázat: kb. minden harmadik ilyen szelvény nyer.');
		expect(riskText(0.07, 'high')).toBe('Magas kockázat: kb. minden tizennegyedik ilyen szelvény nyer.');
		expect(riskText(0.8, 'low')).toBe('Alacsony kockázat: a legtöbb ilyen szelvény nyer.');
		const legs = [
			{ fixtureId: 1, pModel: 0.61, bestOdds: 1.8 },
			{ fixtureId: 2, pModel: 0.64, bestOdds: 1.72 }
		];
		expect(singlesNote(summarizeSlip(legs, 1000)!, 1000)).toBe(
			`Ugyanezek szingliben: 2 × 1${NBSP}000${NBSP}Ft tét, várható haszon 199${NBSP}Ft. A kötés nagyobbat fizet, de ritkábban jön be.`
		);
		expect(singlesNote(summarizeSlip(legs.slice(0, 1), 1000)!, 1000)).toBeNull();
	});
});

describe('SlipPanel', () => {
	it('shows the empty state with the engine presets', () => {
		let html = renderToStaticMarkup(<SlipPanel store={new SlipStore(memorySlipStorage())} now={now} />);
		expect(html).toContain('Még üres. Adj hozzá tippet a listából.');
		expect(html).toContain('nincs tipp');
		expect(html).not.toContain('Kész szelvények');
		html = renderToStaticMarkup(<SlipPanel store={new SlipStore(memorySlipStorage())} now={now} presetTips={sampleTips(now)} />);
		expect(html).toContain('oe-slip__hint');
		expect(html).toContain('Kész szelvények');
		expect(html).toContain('class="oe-preset"');
		expect(html).not.toContain('Tippmixre viszem');
	});

	it('renders legs, totals, stake and the transfer form', () => {
		const store = new SlipStore(memorySlipStorage());
		store.toggle(a);
		store.toggle(b);
		let html = renderToStaticMarkup(<SlipPanel store={store} now={now} />);
		expect(html).toContain('Dupla kötés · 2 tipp');
		expect(html).toContain('Eredő odds');
		expect(html).toContain('Lehetséges nyeremény');
		expect(html).toContain('aria-label="Tipp levétele a szelvényről"');
		expect(html).toContain('aria-pressed="true">1');
		expect(html).toContain('Tippmixre viszem');
		expect(html).toContain('Szelvény ürítése');
		expect(html).toContain('oe-risk__fill" data-level=');
		expect(html).not.toContain('Kész szelvények');

		store.openTransfer();
		store.setTippmixInput(a.id, '1,01');
		html = renderToStaticMarkup(<SlipPanel store={store} now={now} />);
		expect(html).toContain('inputMode="decimal"');
		expect(html).toContain('✗ min. alatt');
		expect(html).toContain('odds kell');
		expect(html).toContain('Megtettem – szelvény mentése');
		expect(html).toMatch(/disabled=""/);
	});

	it('adds the mobile slip bar that jumps to the panel when the slip is filled', () => {
		const store = new SlipStore(memorySlipStorage());
		let html = renderToStaticMarkup(<SlipPanel store={store} now={now} />);
		expect(html).not.toContain('Szelvény összesítő');
		store.toggle(a);
		store.toggle(b);
		html = renderToStaticMarkup(<SlipPanel store={store} now={now} />);
		expect(html).toContain('Szelvény · 2 tipp, dupla kötés');
		expect(html).toContain('href="#szelveny"');
		expect(html).toContain('id="szelveny"');
		expect(html).not.toContain('role="dialog"');
	});
});
