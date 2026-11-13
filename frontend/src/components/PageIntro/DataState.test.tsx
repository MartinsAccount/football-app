import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import DataState from './DataState';

describe('DataState', () => {
	it('renders the warning pill, side chips and a closed disclosure', () => {
		const html = renderToStaticMarkup(
			<DataState label="Mentett adat · 2025. ápr. 12–13." chips={['Odds 17 órás']} detail="Magyarázat." />
		);
		expect(html).toContain('<span class="oe-pill oe-pill--warning">Mentett adat · 2025. ápr. 12–13.</span>');
		expect(html).toContain('<span class="oe-pill">Odds 17 órás</span>');
		expect(html).toContain('aria-expanded="false" aria-controls="datastate"');
		expect(html).toContain('id="datastate" hidden="">Magyarázat.</div>');
	});
});
