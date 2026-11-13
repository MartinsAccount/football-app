import { readFileSync } from 'fs';
import { resolve } from 'path';
import { cacheStrategy, ICacheRequest } from './cacheStrategy';

const ORIGIN = 'https://odds.example';

const sharedBlock = (file: string) => {
	const src = readFileSync(resolve(__dirname, file), 'utf8').replace(/\r\n/g, '\n');
	const m = src.match(/\/\/ SW-SHARED-START\n([\s\S]*?)\/\/ SW-SHARED-END/);
	if (!m) throw new Error(`nincs SW-SHARED blokk: ${file}`);
	return m[1].trim();
};

const CASES: [ICacheRequest, string][] = [
	[{ method: 'POST', url: '/api/odds' }, 'network-only'],
	[{ method: 'GET', url: 'https://v3.football.api-sports.io/fixtures' }, 'network-only'],
	[{ method: 'GET', url: '/sw.js' }, 'network-only'],
	[{ method: 'GET', url: '/api/fixtures?date=2025-04-12' }, 'network-first'],
	[{ method: 'GET', url: '/api/budget', mode: 'cors' }, 'network-first'],
	[{ method: 'GET', url: '/data/fixtures.JSON' }, 'network-first'],
	[{ method: 'GET', url: '/manifest.json' }, 'network-first'],
	[{ method: 'GET', url: '/evaluation', mode: 'navigate' }, 'navigate'],
	[{ method: 'GET', url: `${ORIGIN}/`, mode: 'navigate' }, 'navigate'],
	[{ method: 'GET', url: '/assets/index-abc123.js' }, 'cache-first'],
	[{ method: 'GET', url: '/icons/icon-192.png' }, 'cache-first']
];

describe('cacheStrategy', () => {
	it.each(CASES)('%j → %s', (req, expected) => {
		expect(cacheStrategy(req, ORIGIN)).toBe(expected);
	});

	it('a public/sw.js ugyanazt a szabályt tartalmazza', () => {
		expect(sharedBlock('../../public/sw.js')).toBe(sharedBlock('./cacheStrategy.ts'));
	});

	it('a sw.js-ből kiemelt szabály ugyanúgy dönt', () => {
		const swPick = new Function(`${sharedBlock('../../public/sw.js')}; return pickStrategy;`)();
		for (const [req, expected] of CASES) expect(swPick(req, ORIGIN)).toBe(expected);
	});
});
