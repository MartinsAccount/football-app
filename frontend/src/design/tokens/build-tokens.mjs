// Generálja a tokens.css és tokens.ts fájlokat a tokens.json (sötét alap) és a
// tokens.light.json (világos felülírások) alapján.
// Emellett a packages/theme/src/theme.generated.ts-be feloldott, CSS-változó nélküli RN-témát ír.
// Futtatás: node build-tokens.mjs           (függőség nélkül, Node 18+)
//           node build-tokens.mjs --check   (nem ír; hibával kilép, ha valamelyik generált fájl elavult)
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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

// A téma-nevek és a tárolási kulcs egyetlen forrása a core (theme/theme.ts); itt csak re-export.
export type { ThemeName, ThemePreference } from '@football/core';
export { THEME_STORAGE_KEY } from '@football/core';

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

// ---- React Native téma (packages/theme) ----
// Szabályok: szín → string (hex/rgba), dimension px → szám, em → szám (em-ben, RN-ben × fontSize),
// duration ms → szám, fontFamily → az első (saját) betűcsalád neve, shadow → RN shadow* + elevation.
const resolveRaw = (key, layers, seen = new Set()) => {
  if (seen.has(key)) throw new Error('Körkörös hivatkozás: ' + key);
  seen.add(key);
  const v = layers.map((l) => l.get(key)).find(Boolean).$value;
  return isRef(v) ? resolveRaw(refKey(v), layers, seen) : v;
};
const rnDimension = (key, v) => {
  const m = /^(-?\d*\.?\d+)(px|em)$/.exec(String(v));
  if (!m) throw new Error(`RN-téma: nem fordítható dimension "${key}": ${v}`);
  return Number(m[1]);
};
const rnShadow = (v) => {
  if (v === 'none') return { shadowColor: 'transparent', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 };
  const m = /^(-?\d+)(?:px)? (-?\d+)(?:px)? (\d+)(?:px)? (rgba?\([^)]*\)|#[0-9a-fA-F]{3,8})$/.exec(String(v).trim());
  // TODO(polish): spread / több rétegű árnyék nincs fordítva – ilyenkor a token értéke null (RN-ben nincs árnyék).
  if (!m) return null;
  const [, x, y, blur, color] = m;
  return { shadowColor: color, shadowOffset: { width: Number(x), height: Number(y) }, shadowOpacity: 1, shadowRadius: Number(blur), elevation: Math.max(1, Math.round(Number(blur) / 2)) };
};
const rnValue = (key, layers) => {
  const raw = resolveRaw(key, layers);
  switch (base.get(key).$type) {
    case 'dimension': return rnDimension(key, raw);
    case 'duration': return Number(String(raw).replace(/ms$/, ''));
    case 'fontFamily': return Array.isArray(raw) ? raw[0] : String(raw);
    case 'shadow': return rnShadow(raw);
    default: return raw;
  }
};
const rnTree = (layers) => {
  const t = {};
  for (const key of base.keys()) {
    const parts = key.split('.');
    let node = t;
    parts.slice(0, -1).forEach((p) => { node = node[p] ??= {}; });
    node[parts.at(-1)] = rnValue(key, layers);
  }
  return t;
};
const indented = (o) => JSON.stringify(o, null, 2).replace(/\n/g, '\n  ');
const rn = `// GENERÁLT FÁJL – ne szerkeszd kézzel. Forrás: frontend/src/design/tokens/tokens.json + tokens.light.json,
// generátor: frontend/src/design/tokens/build-tokens.mjs (npm run tokens -w football-app-web).
// Feloldott értékek React Nativehoz: nincs CSS-változó; a méretek számok (px), a font.tracking em-ben (× fontSize),
// a line-height szorzó (× fontSize), a motion ms-ben, az árnyék RN shadow*/elevation alakban.

export const rnThemes = {
  dark: ${indented(rnTree([base]))},
  light: ${indented(rnTree([light, base]))}
} as const;

/** Az összes token-útvonal (pont-elválasztva), a tokens.json sorrendjében. */
export const tokenPaths = ${JSON.stringify([...base.keys()], null, 2)} as const;
`;

const outputs = [
  [join(here, 'tokens.css'), css],
  [join(here, 'tokens.ts'), ts],
  [join(here, '../../../../packages/theme/src/theme.generated.ts'), rn]
];
if (process.argv.includes('--check')) {
  const stale = outputs.filter(([f, c]) => !existsSync(f) || readFileSync(f, 'utf8').replace(/\r\n/g, '\n') !== c).map(([f]) => f);
  if (stale.length) {
    console.error('Elavult generált token-fájl(ok) – futtasd: npm run tokens -w football-app-web\n' + stale.join('\n'));
    process.exit(1);
  }
  console.log('OK – a generált token-fájlok frissek');
} else {
  for (const [f, c] of outputs) writeFileSync(f, c);
  console.log(`OK – ${base.size} token (ebből ${light.size} világos felülírás) → tokens.css, tokens.ts, packages/theme/src/theme.generated.ts`);
}
