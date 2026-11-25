/** @type {import('tailwindcss').Config} */

// Floodlight design tokenek (frontend/src/design/tokens/tokens.css) → Tailwind theme.
// Minden érték CSS-változóra mutat; a forrás a tokens.json (DESIGN.md §2).
// A `<alpha-value>` + color-mix miatt az átlátszóság-módosítók (pl. bg-accent/10) is működnek.
const c = (name) => `color-mix(in srgb, var(--color-${name}) calc(<alpha-value> * 100%), transparent)`;

module.exports = {
	content: ['./src/**/*.{ts,tsx}'],
	// A Preflight (Tailwind globális alap-reset) BE van kapcsolva (alapértelmezett). Lásd ADR 0001.
	theme: {
		extend: {
			colors: {
				// Floodlight nevek
				canvas: c('bg-canvas'),
				raised: c('bg-raised'),
				inset: c('bg-inset'),
				track: c('bg-track'),
				selected: c('bg-selected'),
				'text-primary': c('text-primary'),
				'text-secondary': c('text-secondary'),
				'text-inverse': c('text-inverse'),
				'border-default': c('border-default'),
				'border-strong': c('border-strong'),
				warning: c('signal-warning'),
				neutral: c('signal-neutral'),
				'data-model': c('data-model'),
				'data-market': c('data-market'),
				'accent-text': c('accent-text'),
				'accent-on': c('accent-on'),
				'on-bg': c('on-bg'),
				'on-fg': c('on-fg'),
				overlay: c('overlay'),
				'negative-text': c('signal-negative-text'),
				'warning-text': c('signal-warning-text'),
				'tint-positive': c('tint-positive-bg'),
				'tint-positive-border': c('tint-positive-border'),
				'tint-warning': c('tint-warning-bg'),
				'tint-warning-border': c('tint-warning-border'),
				'tint-negative': c('tint-negative-bg'),
				'tint-negative-border': c('tint-negative-border'),
				// Régi (pre-Floodlight) nevek, most tokenre kötve – a meglévő komponensek így változatlanul futnak.
				// TODO(polish): az A3 oldal-átírásoknál a Floodlight nevekre cserélni, utána ezeket törölni.
				bg: c('bg-canvas'),
				surface: c('bg-surface'),
				'surface-2': c('bg-raised'),
				sidebar: c('bg-inset'),
				brand: c('accent-default'),
				accent: c('accent-default'),
				text: c('text-primary'),
				'text-muted': c('text-muted'),
				'text-faint': c('signal-neutral'),
				positive: c('signal-positive'),
				negative: c('signal-negative'),
				'border-subtle': c('border-default')
			},
			fontFamily: {
				display: 'var(--font-family-display)',
				body: 'var(--font-family-body)',
				sans: 'var(--font-family-body)'
			},
			fontSize: {
				micro: 'var(--font-size-micro)',
				caption: 'var(--font-size-caption)',
				small: 'var(--font-size-small)',
				body: 'var(--font-size-body)',
				lead: 'var(--font-size-lead)',
				h3: 'var(--font-size-h3)',
				match: 'var(--font-size-match)',
				page: 'var(--font-size-page)',
				'h1-mobile': 'var(--font-size-h1-mobile)',
				h1: 'var(--font-size-h1)',
				'num-s': 'var(--font-size-num-s)',
				'num-m': 'var(--font-size-num-m)',
				'num-l': 'var(--font-size-num-l)',
				'num-xl': 'var(--font-size-num-xl)'
			},
			borderRadius: {
				xs: 'var(--radius-xs)',
				s: 'var(--radius-s)',
				m: 'var(--radius-m)',
				l: 'var(--radius-l)',
				xl: 'var(--radius-xl)',
				'2xl': 'var(--radius-2xl)',
				'3xl': 'var(--radius-3xl)',
				'4xl': 'var(--radius-4xl)',
				pill: 'var(--radius-pill)'
			},
			// Térköz: a Tailwind numerikus skálája megmarad (meglévő osztályok); a tokenek `sp-N` és méret-nevekkel érhetők el.
			spacing: {
				...Object.fromEntries(
					[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 28].map((n) => [`sp-${n}`, `var(--space-${n})`])
				),
				touch: 'var(--size-touch)',
				control: 'var(--size-control)',
				cta: 'var(--size-cta)',
				bar: 'var(--size-bar)',
				'bar-lg': 'var(--size-bar-lg)',
				pill: 'var(--size-pill)'
			},
			boxShadow: {
				card: 'var(--shadow-card)'
			},
			maxWidth: {
				container: 'var(--size-container)',
				aside: 'var(--size-aside-basis)'
			},
			transitionDuration: {
				fast: 'var(--motion-fast)',
				base: 'var(--motion-base)',
				slow: 'var(--motion-slow)'
			},
			transitionTimingFunction: {
				floodlight: 'var(--motion-easing)'
			}
		}
	},
	plugins: []
};
