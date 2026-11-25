import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import PageHead from './PageHead';

describe('PageHead', () => {
	it('kompakt cím, meta-chipek és szűrő-slot', () => {
		const html = renderToStaticMarkup(
			<PageHead title="Kiértékelés" chips={['3 504 meccs', 'EV ≥ 5%']} filters={<button>1X2</button>} />
		);
		expect(html).toContain('<h1 class="oe-page-title">Kiértékelés</h1>');
		expect(html.match(/class="oe-meta-chip"/g)).toHaveLength(2);
		expect(html).toContain('<div class="oe-filters"><button>1X2</button></div>');
	});

	it('chipek és szűrők nélkül nincs üres konténer', () => {
		const html = renderToStaticMarkup(<PageHead title="Arbitrázs" />);
		expect(html).not.toContain('oe-chips');
		expect(html).not.toContain('oe-filters');
	});
});
