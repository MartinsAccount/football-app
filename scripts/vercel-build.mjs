// Vercel Build Output API (v3) csomagoló (I30, docs/deploy/vercel.md). A `vercel.json` `buildCommand`-ja futtatja a
// frontend-build után. Saját esbuild-csomag, mert a workspace-csomagok TS-forrásként mennek (`exports: ./src/index.ts`,
// kiterjesztés nélküli ESM-importok), amit a Vercel Node-builder nem garantáltan fordít le.
//   .vercel/output/static/                 ← frontend/build
//   .vercel/output/functions/api.func/     ← index.mjs (bundle) + data/*/*-v0.json + .vc-config.json
//   .vercel/output/config.json             ← route-ok (API → függvény, fájlrendszer, SPA-fallback) + 15 perces schedule
// Lokálisan: `npm run build && node scripts/vercel-build.mjs`, majd `node scripts/vercel-build.mjs --serve` (port 5300).
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '.vercel', 'output');
const FUNC = join(OUT, 'functions', 'api.func');
const SNAPSHOTS = ['recommendations/recommendations-v0.json', 'backtest/backtest-v0.json', 'arbitrage/arbitrage-v0.json'];

if (process.argv.includes('--serve')) {
	// Füstteszt: a kész csomag sima Node alatt, a Vercel-launcherhez hasonló `(req, res)` hívással.
	const { default: handler } = await import(pathToFileURL(join(FUNC, 'index.mjs')).href);
	const port = Number(process.env.PORT ?? 5300);
	createServer(handler).listen(port, () => console.log(`[vercel-build] http://localhost:${port}/api/…`));
} else {
	const frontend = join(ROOT, 'frontend', 'build');
	if (!existsSync(join(frontend, 'index.html'))) throw new Error('frontend/build hiányzik – előbb: npm run build');

	rmSync(OUT, { recursive: true, force: true });
	cpSync(frontend, join(OUT, 'static'), { recursive: true });

	mkdirSync(FUNC, { recursive: true });
	await build({
		entryPoints: [join(ROOT, 'packages', 'server', 'src', 'vercelEntry.ts')],
		outfile: join(FUNC, 'index.mjs'),
		bundle: true,
		platform: 'node',
		format: 'esm',
		target: 'node22',
		// A `pg` CJS: az ESM-csomagban a `require` kell neki; a natív kötés opcionális.
		banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
		external: ['pg-native'],
		logLevel: 'warning'
	});
	for (const rel of SNAPSHOTS) {
		const src = join(ROOT, 'data', rel);
		if (!existsSync(src)) continue; // hiányzó pillanatkép → a végpont 404
		mkdirSync(dirname(join(FUNC, 'data', rel)), { recursive: true });
		cpSync(src, join(FUNC, 'data', rel));
	}
	writeFileSync(
		join(FUNC, '.vc-config.json'),
		JSON.stringify(
			{ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, maxDuration: 300 },
			null,
			2
		)
	);
	writeFileSync(
		join(OUT, 'config.json'),
		JSON.stringify(
			{
				version: 3,
				routes: [{ src: '^/api(?:/.*)?$', dest: '/api' }, { handle: 'filesystem' }, { src: '^/(.*)$', dest: '/index.html' }],
				// Hobby: 15 percnél sűrűbb nem lehet, a jitter mindig 15 perc. Path target → `Authorization: Bearer <CRON_SECRET>`.
				schedules: { 'cron-tick': { schedule: '*/15 * * * *', path: '/api/cron/tick' } }
			},
			null,
			2
		)
	);
	console.log('[vercel-build] .vercel/output kész');
}
