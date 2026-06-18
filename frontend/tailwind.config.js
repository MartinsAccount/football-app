/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{ts,tsx}'],
	// A Preflight (Tailwind globális reset) most KI van kapcsolva: a setup-fázisban
	// az app vizuálisan változatlan kell maradjon. A redesign-fázisban kapcsoljuk vissza,
	// kontrollált módon. A meglévő SCSS reset (Main.module.scss) érvényben marad.
	corePlugins: {
		preflight: false
	},
	theme: {
		extend: {
			// Design tokenek a docs/design/odds-design.png alapján.
			// Névvel hivatkozhatók (pl. bg-bg, text-text-muted, border-border-subtle).
			// A spacing- és típusskála szándékosan a Tailwind defaultja marad.
			colors: {
				bg: '#14161C',
				surface: '#1C1F27',
				'surface-2': '#1A1D24',
				sidebar: '#16181F',
				brand: '#C02434',
				accent: '#F5A623',
				text: '#E8E9ED',
				'text-muted': '#9CA0AB',
				'text-faint': '#6E727D',
				positive: '#4ADE80',
				negative: '#F87171',
				'border-subtle': 'rgba(255,255,255,0.08)'
			}
		}
	},
	plugins: []
};
