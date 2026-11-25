import { formatKickoff, formatOdds, formatPairing, formatPercent } from '../format/format';
import type { DrawFactor } from './model';

// „Döntetlen-esélyek” nézet-modell (D2 web, D3 mobil). A core nem függhet a `@football/contract`-tól (az függ a core-tól), ezért
// a `DrawsResponse` szerkezeti mása áll itt; a contract `DrawsResponse` ennek megfelel.

/** A D1-backtest riportja (a megjegyzés erre utal). */
export const DRAW_REPORT_PATH = 'docs/analysis/backtests/2026-11-17-draws.md';
export const DRAW_NOTE = 'Tesztelve a piac szintjén – nem értéktipp.';
/** A tényező-csipek jelentése (a csip a piaci p(X)-hez képesti korrekciót mutatja, nem a nyers tényezőt). */
export const DRAW_FACTOR_LEGEND = 'A csipek: a tényező a piaci becsléshez képest emeli vagy csökkenti a döntetlen-esélyt.';

export interface DrawWatchViewInput {
	modelVersion: string;
	analyzed: number;
	items: {
		fixtureId: number;
		league: { name: string };
		kickoff: string;
		home: { name: string };
		away: { name: string };
		pDraw: number;
		pMarket: number;
		drawOdds: number | null;
		factors: DrawFactor[];
	}[];
}

export interface IDrawFactorChip {
	key: string;
	/** `Erőkülönbség (Elo): emeli` – a döntetlen-esély iránya a piachoz képest, szóval (a nyíl félrevezető volt). */
	label: string;
	direction: 'up' | 'down';
	detail: string;
	/** Képernyőolvasónak: `Erőkülönbség (Elo) emeli a döntetlen-esélyt: erőkülönbség: 210 Elo-pont`. */
	aria: string;
}

export interface IDrawRow {
	id: number;
	title: string;
	meta: string;
	pDraw: string;
	/** `piac 29% · X 3,40` */
	market: string;
	factors: IDrawFactorChip[];
}

const factorChip = (f: DrawFactor): IDrawFactorChip => {
	const up = f.contribution >= 0;
	const verb = up ? 'emeli' : 'csökkenti';
	return {
		key: f.key,
		label: `${f.label}: ${verb}`,
		direction: up ? 'up' : 'down',
		detail: f.detail,
		aria: `${f.label} ${verb} a döntetlen-esélyt: ${f.detail}`
	};
};

/** `/api/draws` → a „Döntetlen-esélyek” blokk sorai (a sorrend a szerveré: p(X) szerint csökkenő). */
export const drawRows = (res: DrawWatchViewInput, now: Date): IDrawRow[] =>
	res.items.map((i) => ({
		id: i.fixtureId,
		title: formatPairing(i.home.name, i.away.name),
		meta: `${i.league.name} · ${formatKickoff(new Date(i.kickoff), now)}`,
		pDraw: formatPercent(i.pDraw),
		market: `piac ${formatPercent(i.pMarket)}${i.drawOdds === null ? '' : ` · X ${formatOdds(i.drawOdds)}`}`,
		factors: i.factors.map(factorChip)
	}));

/** Fejléc-alcím: `40 meccsből top 10 · p(X) szerint`. */
export const drawSubtitle = (res: DrawWatchViewInput): string =>
	`${res.analyzed} meccsből top ${res.items.length} · p(X) szerint`;
