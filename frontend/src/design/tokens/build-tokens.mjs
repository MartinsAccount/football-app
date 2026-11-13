// Generálja a tokens.css és tokens.ts fájlokat a tokens.json (sötét alap) és a
// tokens.light.json (világos felülírások) alapján.
// Futtatás: node build-tokens.mjs   (függőség nélkül, Node 18+)
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(here, f), 'utf8'));

const flatten = (root) => {
  const out = new Map();
  const walk = (node, path) => {
    for (const [k, v] of Object.entries(node)) {
      if (k.startsWith('$')) continue;
      if (v && typeof v === 'object' && '$value' in v) out.set([...path, k].join('.'), v);
      else if (v && typeof v === 'object') walk(v, [...path, k]);
    }
  };
  walk(root, []);
  return out;
};

const base = flatten(read('tokens.json'));
const light = flatten(read('tokens.light.json'));
for (const key of light.keys()) {
  if (!base.has(key)) throw new Error(`tokens.light.json: ismeretlen token "${key}" (előbb vedd fel a tokens.json-ba)`);
}

const cssName = (key) => '--' + key.split('.').join('-');
const isRef = (v) => typeof v === 'string' && /^\{[^}]+\}$/.test(v);
const refKey = (v) => v.slice(1, -1);

const toCss = (tok) => {
  const v = tok.$value;
  if (isRef(v)) {
    if (!base.has(refKey(v))) throw new Error('Ismeretlen hivatkozás: ' + v);
    return `var(${cssName(refKey(v))})`;
  }
  if (Array.isArray(v) && tok.$type === 'fontFamily') return v.map((f) => (/\s/.test(f) ? `"${f}"` : f)).join(', ');
  if (Array.isArray(v) && tok.$type === 'cubicBezier') return `cubic-bezier(${v.join(', ')})`;
  return String(v);
};

const resolve = (key, layers, seen = new Set()) => {
  if (seen.has(key)) throw new Error('Körkörös hivatkozás: ' + key);
  seen.add(key);
  const tok = layers.map((l) => l.get(key)).find(Boolean);
  const v = tok.$value;
  if (isRef(v)) return resolve(refKey(v), layers, seen);
  if (Array.isArray(v) && tok.$type === 'fontFamily') return toCss(tok);
  return v;
};

const block = (map, indent = '  ') => [...map].map(([k, t]) => `${indent}${cssName(k)}: ${toCss(t)};`).join('\n');

const css = `/* GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json + tokens.light.json, generátor: build-tokens.mjs */

/* Alap = sötét téma */
:root {
  color-scheme: dark;
${block(base)}
}

/* Világos téma: kézi választás */
:root[data-theme="light"] {
  color-scheme: light;
${block(light)}
}

/* Világos téma: rendszerbeállítás, ha a felhasználó nem választott kézzel */
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) {
    color-scheme: light;
${block(light, '    ')}
  }
}

/* Akcent-variáns (opcionális): <html data-accent="blue|violet"> */
:root[data-accent="blue"] { --color-accent-default: var(--color-accent-alt-blue); --color-accent-text: var(--color-accent-alt-blue); }
:root[data-accent="violet"] { --color-accent-default: var(--color-accent-alt-violet); --color-accent-text: var(--color-accent-alt-violet); }
`;

const tree = (layers) => {
  const t = {};
  for (const key of base.keys()) {
    const parts = key.split('.');
    let node = t;
    parts.slice(0, -1).forEach((p) => { node = node[p] ??= {}; });
    node[parts.at(-1)] = resolve(key, layers);
  }
  return t;
};
const cssVars = Object.fromEntries([...base.keys()].map((k) => [k, `var(${cssName(k)})`]));

const ts = `// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: tokens.json + tokens.light.json, generátor: build-tokens.mjs

export type ThemeName = 'dark' | 'light';
export type ThemePreference = ThemeName | 'system';
/** localStorage kulcs a kézi témaválasztáshoz. Hiányában a rendszerbeállítás érvényes. */
export const THEME_STORAGE_KEY = 'oe-theme';

/** Feloldott nyers értékek témánként (chart-könyvtárakhoz, canvas/SVG rajzhoz). */
export const themes = {
  dark: ${JSON.stringify(tree([base]), null, 2).replace(/\n/g, '\n  ')},
  light: ${JSON.stringify(tree([light, base]), null, 2).replace(/\n/g, '\n  ')}
} as const;

/** @deprecated – használd: themes.dark */
export const tokens = themes.dark;

/** CSS-változó hivatkozások – komponensben ezt használd, így a téma-váltás magától működik. */
export const cssVar = ${JSON.stringify(cssVars, null, 2)} as const;

export type TokenPath = keyof typeof cssVar;
export const v = (path: TokenPath): string => cssVar[path];
`;

writeFileSync(join(here, 'tokens.css'), css);
writeFileSync(join(here, 'tokens.ts'), ts);
console.log(`OK – ${base.size} token (ebből ${light.size} világos felülírás) → tokens.css, tokens.ts`);
