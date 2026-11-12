// Generálja a tokens.css és tokens.ts fájlokat a tokens.json-ból.
// Futtatás: node tokens/build-tokens.mjs   (függőség nélkül)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = JSON.parse(readFileSync(join(here, 'tokens.json'), 'utf8'));

const flat = [];
const walk = (node, path) => {
  for (const [k, v] of Object.entries(node)) {
    if (k.startsWith('$')) continue;
    if (v && typeof v === 'object' && '$value' in v) flat.push({ path: [...path, k], token: v });
    else if (v && typeof v === 'object') walk(v, [...path, k]);
  }
};
walk(src, []);

const byPath = new Map(flat.map((t) => [t.path.join('.'), t]));
const cssName = (path) => '--' + path.join('-');
const isRef = (v) => typeof v === 'string' && /^\{[^}]+\}$/.test(v);

const toCss = (t) => {
  const v = t.token.$value;
  if (isRef(v)) return `var(${cssName(v.slice(1, -1).split('.'))})`;
  if (Array.isArray(v) && t.token.$type === 'fontFamily') return v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
  if (Array.isArray(v) && t.token.$type === 'cubicBezier') return `cubic-bezier(${v.join(', ')})`;
  return String(v);
};
const resolve = (t, seen = new Set()) => {
  const v = t.token.$value;
  if (!isRef(v)) return v;
  const key = v.slice(1, -1);
  if (seen.has(key)) throw new Error('Körkörös hivatkozás: ' + key);
  seen.add(key);
  const target = byPath.get(key);
  if (!target) throw new Error('Ismeretlen hivatkozás: ' + key);
  return resolve(target, seen);
};

const css = [
  '/* GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json, generátor: build-tokens.mjs */',
  ':root {',
  ...flat.map((t) => `  ${cssName(t.path)}: ${toCss(t)};`),
  '}',
  '',
  '/* Téma-akcent váltás: <html data-accent="blue|violet"> */',
  ':root[data-accent="blue"] { --color-accent-default: var(--color-accent-alt-blue); }',
  ':root[data-accent="violet"] { --color-accent-default: var(--color-accent-alt-violet); }',
  ''
].join('\n');

const tree = {};
for (const t of flat) {
  let node = tree;
  t.path.slice(0, -1).forEach((p) => { node = node[p] ??= {}; });
  const v = resolve(t);
  node[t.path.at(-1)] = Array.isArray(v) && t.token.$type === 'fontFamily' ? toCss({ token: { $value: v, $type: 'fontFamily' } }) : v;
}
const cssVars = {};
for (const t of flat) cssVars[t.path.join('.')] = `var(${cssName(t.path)})`;

const ts = [
  '// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json, generátor: build-tokens.mjs',
  '',
  '/** Feloldott nyers értékek (pl. canvas/SVG rajzhoz, chart-könyvtárakhoz). */',
  `export const tokens = ${JSON.stringify(tree, null, 2)} as const;`,
  '',
  '/** CSS-változó hivatkozások – inline style-ban ezt használd, így a téma-váltás működik. */',
  `export const cssVar = ${JSON.stringify(cssVars, null, 2)} as const;`,
  '',
  'export type TokenPath = keyof typeof cssVar;',
  'export const v = (path: TokenPath): string => cssVar[path];',
  ''
].join('\n');

writeFileSync(join(here, 'tokens.css'), css);
writeFileSync(join(here, 'tokens.ts'), ts);
console.log(`OK – ${flat.length} token → tokens.css, tokens.ts`);
