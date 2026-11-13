import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { rnTheme, rnThemes, tokenPaths } from './index';

const tokensDir = fileURLToPath(new URL('../../../frontend/src/design/tokens/', import.meta.url));

/** A tokens.json összes token-útvonala (ugyanaz a bejárás, mint a generátorban). */
const sourcePaths = (): string[] => {
	const out: string[] = [];
	const walk = (node: Record<string, unknown>, path: string[]) => {
		for (const [k, v] of Object.entries(node)) {
			if (k.startsWith('$') || !v || typeof v !== 'object') continue;
			if ('$value' in v) out.push([...path, k].join('.'));
			else walk(v as Record<string, unknown>, [...path, k]);
		}
	};
	walk(JSON.parse(readFileSync(tokensDir + 'tokens.json', 'utf8')), []);
	return out;
};

const get = (obj: unknown, path: string): unknown =>
	path.split('.').reduce<unknown>((n, k) => (n && typeof n === 'object' ? (n as Record<string, unknown>)[k] : undefined), obj);

const leaves = (obj: unknown): unknown[] =>
	obj && typeof obj === 'object' ? Object.values(obj as object).flatMap(leaves) : [obj];

describe('rnThemes', () => {
	it('a tokenPaths a tokens.json minden kulcsát tartalmazza', () => {
		expect([...tokenPaths]).toEqual(sourcePaths());
	});

	it.each(['dark', 'light'] as const)('a(z) %s téma minden tokenkulcsot lefed', (name) => {
		const missing = sourcePaths().filter((p) => get(rnThemes[name], p) === undefined);
		expect(missing).toEqual([]);
	});

	it.each(['dark', 'light'] as const)('a(z) %s témában nincs var( és nyers px string', (name) => {
		const strings = leaves(rnThemes[name]).filter((x): x is string => typeof x === 'string');
		expect(strings.filter((s) => s.includes('var('))).toEqual([]);
		expect(strings.filter((s) => /\d(px|em|ms)\b/.test(s))).toEqual([]);
	});

	it('a méretek számok, a színek témánként eltérnek, az árnyék RN-alakú', () => {
		const dark = rnTheme('dark');
		const light = rnTheme('light');
		expect(dark.space['8']).toBe(16);
		expect(dark.radius.pill).toBe(999);
		expect(dark.font.size.body).toBe(15);
		expect(dark.font.family.display).toBe('Sora');
		expect(dark.motion.fast).toBe(120);
		expect(dark.color.bg.canvas).toMatch(/^#[0-9A-F]{6}$/i);
		expect(light.color.bg.canvas).not.toBe(dark.color.bg.canvas);
		expect(light.space).toEqual(dark.space);
		expect(dark.shadow.card).toMatchObject({ shadowOpacity: 0, elevation: 0 });
		expect(light.shadow.card).toMatchObject({ shadowOffset: { width: 0, height: 1 }, shadowRadius: 2 });
	});
});
