// Screenshot + layout-mérés headless Edge-dzsel, CDP-n (Playwright nélkül).
//
//   node frontend/scripts/shots.mjs --pages ma=/,kiertekeles=/evaluation --themes dark,light --widths 1440,390 \
//     --out "docs/plans/screens/s27a-{page}-{theme}-{width}.png"
//
// - Ha a --base (alap: http://localhost:3126) nem válaszol, saját Vite-ot indít: `vite --port 3126 --strictPort`
//   (a :3000-en futó régi dev server HMR-cache-e elavult modult adhat).
// - Edge `--remote-debugging-port` (alap 9333), `deviceScaleFactor: 1`, 600 px alatt mobil emuláció (valódi 390-es viewport).
// - Oldalanként kiírja: scrollWidth vs. viewport (vízszintes görgetés), a 44 px-nél alacsonyabb fejléc-elemeket és a
//   konzolhibákat. Kilépési kód 1, ha bármelyik oldalon görget vagy hibát dob.
// - `--click "<css>"`: betöltés után az első illeszkedő elemre kattint (pl. `.oe-preset` → kitöltött szelvény); ha nincs
//   ilyen elem, hibának számít.
// - `--storage <json-fájl>`: `{ kulcs: érték }` localStorage-bejegyzések minden betöltés előtt (pl. `oe_settings` minta-állapot
//   szerver nélkül; az objektum-érték JSON-ként íródik).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const require = createRequire(path.join(repo, 'package.json'));
const WebSocket = require('ws');

const { values: opt } = parseArgs({
	options: {
		pages: { type: 'string', default: 'ma=/,kiertekeles=/evaluation,arbitrazs=/arbitrage,beallitasok=/settings' },
		themes: { type: 'string', default: 'dark,light' },
		widths: { type: 'string', default: '1440,390' },
		out: { type: 'string', default: 'docs/plans/screens/shot-{page}-{theme}-{width}.png' },
		base: { type: 'string', default: 'http://localhost:3126' },
		cdpPort: { type: 'string', default: '9333' },
		wait: { type: 'string', default: '2500' },
		click: { type: 'string', default: '' },
		storage: { type: 'string', default: '' },
		edge: { type: 'string', default: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' }
	}
});

const list = (s) =>
	s
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);
const pages = list(opt.pages).map((p) => {
	const [name, route = '/'] = p.split('=');
	// Git Bash (MSYS) a `ma=/`-t `ma=C:/Program Files/Git/`-re írja át → MSYS_NO_PATHCONV=1, vagy PowerShellből futtasd.
	if (!route.startsWith('/')) throw new Error(`Hibás útvonal: "${route}" (Git Bash alatt: MSYS_NO_PATHCONV=1)`);
	return { name, route };
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const reachable = async (url) => {
	try {
		return (await fetch(url)).ok;
	} catch {
		return false;
	}
};

let vite;
if (!(await reachable(opt.base))) {
	const port = new URL(opt.base).port || '80';
	vite = spawn('npx', ['vite', '--port', port, '--strictPort'], { cwd: path.join(repo, 'frontend'), shell: true });
	for (let i = 0; i < 120 && !(await reachable(opt.base)); i++) await sleep(500);
}

const cdp = `http://127.0.0.1:${opt.cdpPort}`;
const edge = spawn(opt.edge, [
	'--headless=new',
	`--remote-debugging-port=${opt.cdpPort}`,
	`--user-data-dir=${process.env.TEMP ?? '/tmp'}/edge-cdp-shots`,
	'about:blank'
]);
for (let i = 0; i < 40 && !(await reachable(`${cdp}/json/version`)); i++) await sleep(250);
const target = await (await fetch(`${cdp}/json/new?about:blank`, { method: 'PUT' })).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.on('open', r));

let seq = 0;
const pending = new Map();
const errors = [];
ws.on('message', (raw) => {
	const d = JSON.parse(raw);
	if (d.id && pending.has(d.id)) {
		pending.get(d.id)(d);
		pending.delete(d.id);
	}
	if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error')
		errors.push(d.params.args.map((a) => a.value ?? a.description).join(' '));
	if (d.method === 'Runtime.exceptionThrown')
		errors.push(`${d.params.exceptionDetails.text} ${d.params.exceptionDetails.exception?.description ?? ''}`);
});
const send = (method, params = {}) =>
	new Promise((r) => {
		const id = ++seq;
		pending.set(id, r);
		ws.send(JSON.stringify({ id, method, params }));
	});

const MEASURE = `JSON.stringify({
	sw: document.documentElement.scrollWidth, vw: innerWidth, h: document.documentElement.scrollHeight,
	small: [...document.querySelectorAll('header button, header a')]
		.filter((e) => e.getBoundingClientRect().height < 44)
		.map((e) => e.textContent.trim() + ':' + Math.round(e.getBoundingClientRect().height))
})`;

await send('Runtime.enable');
await send('Page.enable');
if (opt.storage) {
	const entries = Object.entries(JSON.parse(fs.readFileSync(path.resolve(opt.storage), 'utf8'))).map(([k, val]) => [
		k,
		typeof val === 'string' ? val : JSON.stringify(val)
	]);
	await send('Page.addScriptToEvaluateOnNewDocument', {
		source: `try { for (const [k, v] of ${JSON.stringify(entries)}) localStorage.setItem(k, v); } catch {}`
	});
}
let failed = false;
for (const { name, route } of pages)
	for (const theme of list(opt.themes))
		for (const width of list(opt.widths).map(Number)) {
			errors.length = 0;
			const metrics = (height) => ({ width, height, deviceScaleFactor: 1, mobile: width < 600 });
			await send('Emulation.setDeviceMetricsOverride', metrics(900));
			const sep = route.includes('?') ? '&' : '?';
			await send('Page.navigate', { url: `${opt.base}${route}${sep}theme=${theme}` });
			await sleep(Number(opt.wait));
			if (opt.click) {
				const expression = `(() => { const el = document.querySelector(${JSON.stringify(
					opt.click
				)}); el?.click(); return !!el; })()`;
				const clicked = (await send('Runtime.evaluate', { expression, returnByValue: true })).result.result.value;
				if (!clicked) errors.push(`--click: nincs ilyen elem: ${opt.click}`);
				await sleep(400);
			}
			const m = JSON.parse((await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })).result.result.value);
			await send('Emulation.setDeviceMetricsOverride', metrics(Math.min(m.h, 6000)));
			await sleep(300);
			const shot = await send('Page.captureScreenshot', { format: 'png' });
			const file = path.resolve(
				repo,
				opt.out.replace('{page}', name).replace('{theme}', theme).replace('{width}', String(width))
			);
			fs.mkdirSync(path.dirname(file), { recursive: true });
			fs.writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
			const scroll = m.sw > m.vw;
			failed ||= scroll || errors.length > 0;
			console.log(
				`${name} ${theme} ${width}: sw=${m.sw} vw=${m.vw}${scroll ? ' HSCROLL' : ''} smallHeader=${JSON.stringify(
					m.small
				)} errors=${errors.length ? JSON.stringify(errors) : 0} → ${path.relative(repo, file)}`
			);
		}

ws.close();
edge.kill();
if (vite) spawn('taskkill', ['/pid', String(vite.pid), '/T', '/F'], { shell: true });
process.exit(failed ? 1 : 0);
