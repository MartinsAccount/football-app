import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ApiError } from '@football/contract';
import RemoteData, { loadErrorText } from './RemoteData';

describe('loadErrorText', () => {
	it('explains network, missing snapshot and other HTTP errors', () => {
		expect(loadErrorText(new ApiError(0, 'network', 'fetch failed'))).toContain('nem érhető el');
		expect(loadErrorText(new ApiError(500, 'http', 'HTTP 500'))).toContain('nem érhető el');
		expect(loadErrorText(new ApiError(404, 'not-found', 'x'))).toContain('Még nincs mentett pillanatkép');
		expect(loadErrorText(new ApiError(500, 'internal', 'boom'))).toBe('Az olvasó API hibát adott (500): boom');
		expect(loadErrorText(new Error('plain'))).toBe('plain');
	});
});

describe('RemoteData', () => {
	it('renders the loading state before the data arrives', () => {
		const html = renderToStaticMarkup(
			<RemoteData title="Kiértékelés" load={() => new Promise<number>(() => undefined)}>
				{(n) => <span>{n}</span>}
			</RemoteData>
		);
		expect(html).toContain('Kiértékelés');
		expect(html).toContain('aria-busy="true"');
		expect(html).toContain('Betöltés…');
	});
});
