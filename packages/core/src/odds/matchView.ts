// Meccs-részlet nézet-logika (ROADMAP 5.7, I20 – web odds-history): iroda-nevek, a kimenet elszámolása a végeredményből,
// a meccs kimenetelének szövege és az odds-mozgás sparkline-geometriája. Tiszta függvények; a sorokat a `history.ts`
// `oddsHistoryMarkets`-e adja.

import { formatScore } from '../format/format';
import { SETTINGS_BOOKMAKERS } from '../settings/settings';
import type { IHistoryPoint, IHistoryRow, IHistorySnapshot } from './history';

/** A football-data CSV „Piaci átlag” / „Piaci maximum” ál-irodái (db `import/footballData.ts`). */
export const AGGREGATE_BOOKMAKER_IDS: readonly number[] = [900001, 900002];

const isAggregate = (id: number) => AGGREGATE_BOOKMAKER_IDS.includes(id);

/**
 * Az ál-irodák (átlag/maximum) jegyzéseit elhagyja azokból a piac+vonal csoportokból, ahol valódi iroda is jegyzett az adott
 * pillanatképben – így a „legjobb iroda” valódi iroda; ha csak ál-iroda van, az marad.
 */
export function withoutAggregateQuotes(snapshots: readonly IHistorySnapshot[]): IHistorySnapshot[] {
	return snapshots.map((s) => {
		const real = new Set(s.quotes.filter((q) => !isAggregate(q.bookmakerId)).map((q) => `${q.marketId}|${q.line ?? ''}`));
		return { ...s, quotes: s.quotes.filter((q) => !isAggregate(q.bookmakerId) || !real.has(`${q.marketId}|${q.line ?? ''}`)) };
	});
}

/** Iroda-név: előbb a kapott (pl. `/api/settings`) nevek, majd a beépített katalógus, végül `Iroda #id`. */
export const bookmakerName = (id: number, names?: ReadonlyMap<number, string>): string =>
	names?.get(id) ?? SETTINGS_BOOKMAKERS.find((b) => b.id === id)?.name ?? `Iroda #${id}`;

export type SelectionResult = 'win' | 'loss' | 'void';

/**
 * Egy kimenet elszámolása a végeredményből (90 perc). Piacok: 1 Végeredmény, 2 Hazai/Vendég (döntetlen → visszajár),
 * 5 Gólszám (vonal; egész vonalon egyenlőség → visszajár), 8 Mindkét csapat gól, 12 Kétesélyes. Ismeretlen → `null`.
 */
export function selectionResult(
	marketId: number,
	line: number | null,
	selection: string,
	goalsHome: number,
	goalsAway: number
): SelectionResult | null {
	const winner = goalsHome > goalsAway ? 'Home' : goalsHome < goalsAway ? 'Away' : 'Draw';
	const hit = (ok: boolean): SelectionResult => (ok ? 'win' : 'loss');
	switch (marketId) {
		case 1:
			return ['Home', 'Draw', 'Away'].includes(selection) ? hit(selection === winner) : null;
		case 2:
			if (selection !== 'Home' && selection !== 'Away') return null;
			return winner === 'Draw' ? 'void' : hit(selection === winner);
		case 5: {
			if (line == null || (selection !== 'Over' && selection !== 'Under')) return null;
			const total = goalsHome + goalsAway;
			if (total === line) return 'void';
			return hit(selection === 'Over' ? total > line : total < line);
		}
		case 8:
			if (selection !== 'Yes' && selection !== 'No') return null;
			return hit((goalsHome > 0 && goalsAway > 0) === (selection === 'Yes'));
		case 12: {
			const parts = selection.split('/');
			return parts.length === 2 && parts.every((p) => ['Home', 'Draw', 'Away'].includes(p)) ? hit(parts.includes(winner)) : null;
		}
		default:
			return null;
	}
}

export const SELECTION_RESULT_LABELS: Readonly<Record<SelectionResult, string>> = {
	win: 'bejött',
	loss: 'nem jött be',
	void: 'visszajár'
};

export interface IMatchResultInput {
	status: string;
	goalsHome?: number | null;
	goalsAway?: number | null;
	htHome?: number | null;
	htAway?: number | null;
}

/** A meccs kimenetele szövegként: `5–2 (félidő 2–2) · hazai győzelem`; nem lejátszott meccsnél `null`. */
export function matchResultText(f: IMatchResultInput): string | null {
	if (f.goalsHome == null || f.goalsAway == null) return null;
	const ht = f.htHome != null && f.htAway != null ? ` (félidő ${formatScore(f.htHome, f.htAway)})` : '';
	const who = f.goalsHome > f.goalsAway ? 'hazai győzelem' : f.goalsHome < f.goalsAway ? 'vendéggyőzelem' : 'döntetlen';
	return `${formatScore(f.goalsHome, f.goalsAway)}${ht} · ${who}`;
}

/** A sor legmagasabb oddja (a legjobb ajánlat a megfigyelt időszakban) és az irodája; egyenlőségnél a korábbi. */
export const peakPoint = (row: Pick<IHistoryRow, 'points'>): IHistoryPoint =>
	row.points.reduce((best, p) => (p.odd > best.odd ? p : best), row.points[0]);

export interface ISparkline {
	/** SVG `points` attribútum (`x,y x,y …`). */
	points: string;
	dots: { x: number; y: number }[];
}

/**
 * Sparkline-geometria egy `width × height` dobozba (`pad` belső margóval): x = idő szerint egyenletes lépés, y = odds
 * (magasabb odds feljebb). Egy pont vagy változatlan odds → vízszintes vonal középen.
 */
export function sparkline(odds: readonly number[], width: number, height: number, pad = 0): ISparkline {
	if (odds.length === 0) return { points: '', dots: [] };
	const min = Math.min(...odds);
	const max = Math.max(...odds);
	const w = width - 2 * pad;
	const h = height - 2 * pad;
	const round = (n: number) => Math.round(n * 10) / 10;
	const dots = odds.map((o, i) => ({
		x: round(pad + (odds.length === 1 ? w / 2 : (i / (odds.length - 1)) * w)),
		y: round(pad + (max === min ? h / 2 : ((max - o) / (max - min)) * h))
	}));
	const line =
		dots.length === 1
			? [
					{ x: pad, y: dots[0].y },
					{ x: pad + w, y: dots[0].y }
			  ]
			: dots;
	return { points: line.map((d) => `${d.x},${d.y}`).join(' '), dots };
}
