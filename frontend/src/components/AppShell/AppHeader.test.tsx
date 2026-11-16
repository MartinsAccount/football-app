import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'mobx-react';
import { MemoryRouter } from 'react-router-dom';
import { IThemeEnv, ThemeStore } from '../../stores/ThemeStore';
import AppHeader from './AppHeader';

const env: IThemeEnv = {
	urlTheme: () => null,
	load: () => null,
	save: () => undefined,
	systemPrefersLight: () => false,
	onSystemChange: () => () => undefined,
	apply: () => undefined
};

const render = (path: string) =>
	renderToStaticMarkup(
		<Provider MainStore={{ fetchNumber: 7, ThemeStore: new ThemeStore(env) }}>
			<MemoryRouter initialEntries={[path]}>
				<AppHeader />
			</MemoryRouter>
		</Provider>
	);

describe('AppHeader', () => {
	it('csak az aktív menüpont kap aria-current-et', () => {
		const html = render('/evaluation');
		expect(html.match(/aria-current="page"/g)).toHaveLength(1);
		expect(html).toMatch(/aria-current="page"[^>]*>Kiértékelés</);
		expect(render('/')).toMatch(/aria-current="page"[^>]*>Ma</);
	});

	it('állapot-pill fixture módban: saved, hívásszámmal', () => {
		const html = render('/');
		expect(html).toContain('class="oe-status-pill min-h-touch cursor-pointer bg-transparent" data-state="saved"');
		expect(html).toContain('Mentett adat · 7/100 hívás');
		expect(html).toContain('oe-theme-toggle');
	});
});
