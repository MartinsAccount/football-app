import { formatKickoff, formatOdds, formatPairing, formatPercent } from '@football/core';
import type { DrawsResponse } from '@football/contract';

/** A D1-backtest riportja (a megjegyzés erre utal). */
export const DRAW_REPORT_PATH = 'docs/analysis/backtests/2026-11-17-draws.md';
export const DRAW_NOTE = 'Tesztelve a piac szintjén – nem értéktipp.';

export interface IDrawFactorChip {
	key: string;
	/** `↑ Erőkülönbség (Elo)`: a nyíl az irány (növeli / csökkenti a döntetlen esélyét). */
	label: string;
	detail: string;
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

/** `/api/draws` → a „Döntetlen-esélyek” blokk sorai (a sorrend a szerveré: p(X) szerint csökkenő). */
export const drawRows = (res: DrawsResponse, now: Date): IDrawRow[] =>
	res.items.map((i) => ({
		id: i.fixtureId,
		title: formatPairing(i.home.name, i.away.name),
		meta: `${i.league.name} · ${formatKickoff(new Date(i.kickoff), now)}`,
		pDraw: formatPercent(i.pDraw),
		market: `piac ${formatPercent(i.pMarket)}${i.drawOdds === null ? '' : ` · X ${formatOdds(i.drawOdds)}`}`,
		factors: i.factors.map((f) => ({
			key: f.key,
			label: `${f.contribution >= 0 ? '↑' : '↓'} ${f.label}`,
			detail: f.detail
		}))
	}));

/** Fejléc-alcím: `40 meccsből top 10 · p(X) szerint`. */
export const drawSubtitle = (res: DrawsResponse): string => `${res.analyzed} meccsből top ${res.items.length} · p(X) szerint`;
