/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

/**
 * PWA (docs/plans/mobile.md M1): build után kitölti a `sw.js` helyőrzőit.
 * - precache (app-shell): `/`, `index.html`, a `index.html`-ből hivatkozott assetek (entry JS/CSS, modulepreload),
 *   a manifest és az ikonok. A lusta chunkok (pl. nagy adat-JSON-ok) futásidőben cache-first kerülnek a cache-be.
 * - build-azonosító: a precache-lista + tartalom hash-e → verziózott cache-név, az activate törli a régieket.
 */
function pwaPrecache(): Plugin {
	let outDir = '';
	return {
		name: 'oe-pwa-precache',
		apply: 'build',
		configResolved(c) {
			outDir = resolve(c.root, c.build.outDir);
		},
		closeBundle() {
			const html = readFileSync(join(outDir, 'index.html'), 'utf8');
			const fromHtml = Array.from(html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g), (m) => m[1]);
			const icons = readdirSync(join(outDir, 'icons')).map((f) => `/icons/${f}`);
			const files = Array.from(new Set(['/index.html', '/manifest.json', ...fromHtml, ...icons])).sort();
			const hash = createHash('sha256');
			for (const url of files) hash.update(url).update(readFileSync(join(outDir, url), 'latin1'));
			const swPath = join(outDir, 'sw.js');
			const sw = readFileSync(swPath, 'utf8')
				.replace("'__BUILD_ID__'", JSON.stringify(hash.digest('hex').slice(0, 12)))
				.replace(/\/\*__PRECACHE__\*\/ \[[^\]]*\]/, JSON.stringify(['/', ...files]));
			writeFileSync(swPath, sw);
		}
	};
}

export default defineConfig({
	// A MobX 6 legacy dekorátorai (makeObservable(this) a konstruktorban) (@observable, @inject, @observer): dev módban a plugin-react
	// Babellel parse-ol (Fast Refresh), ezért kell a 'decorators-legacy' szintaxis; az átalakítást
	// az esbuild végzi a tsconfig experimentalDecorators + useDefineForClassFields:false alapján.
	plugins: [react({ babel: { parserOpts: { plugins: ['decorators-legacy'] } } }), pwaPrecache()],
	server: {
		port: 3000,
		strictPort: true,
		// Olvasó API (@football/server, :5100) – a legacy Express (:5000) csak az arbitrázsnak marad (ROADMAP 1.8).
		// A kulcs sorrendje számít: az első illeszkedő nyer.
		proxy: {
			'^/api/(fixtures|odds/|budget|settings|leagues|recommendations|backtest|evaluation|arbitrage|bets|quiz/|profile|draws)':
				'http://localhost:5100',
			'/api': 'http://localhost:5000'
		}
	},
	build: { outDir: 'build' },
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.{ts,tsx}'],
		passWithNoTests: true
	}
});
