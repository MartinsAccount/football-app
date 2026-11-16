// Odds-history nézet-logika (meccs-részlet, M11b): pillanatképek → piac/kimenet soronként a legjobb odd időbeli sora.
// Tiszta függvények; a bemenet szerkezetileg egyezik a contract `OddsSnapshotDto`-jával (a core nem függ a contracttól).

import { formatOdds, formatSignedDecimal } from '../format/format';

export interface IHistoryQuote {
	bookmakerId: number;
	marketId: number;
	selection: string;
	line?: number | null;
	odd: number;
}

export interface IHistorySnapshot {
	capturedAt: string;
	kind?: string;
	quotes: IHistoryQuote[];
}

/** Egy kimenet legjobb oddja egy pillanatképben. */
export interface IHistoryPoint {
	capturedAt: string;
	kind?: string;
	odd: number;
	bookmakerId: number;
	bookmakerCount: number;
}

export type OddsMove = 'up' | 'down' | 'flat';

export interface IHistoryRow {
	key: string;
	selection: string;
	outcomeLabel: string;
	points: IHistoryPoint[];
	opening: number;
	latest: number;
	/** `latest / opening − 1` (0,05 = +5%). */
	change: number;
	move: OddsMove;
}

export interface IHistoryMarket {
	key: string;
	marketId: number;
	line: number | null;
	label: string;
	rows: IHistoryRow[];
}

/** API-Football bet-id → magyar piac-név (a DB `market.id`-je ugyanez). Ismeretlen id → `Piac #id`. */
export const HISTORY_MARKET_LABELS: Readonly<Record<number, string>> = {
	1: 'Végeredmény',
	2: 'Hazai/Vendég',
	5: 'Gólszám',
	8: 'Mindkét csapat gól',
	12: 'Kétesélyes'
};

const OUTCOME_LABELS: Readonly<Record<string, string>> = {
	Home: 'Hazai',
	Draw: 'Döntetlen',
	Away: 'Vendég',
	Over: 'Felett',
	Under: 'Alatt',
	Yes: 'Igen',
	No: 'Nem',
	'Home/Draw': 'Hazai/Döntetlen',
	'Home/Away': 'Hazai/Vendég',
	'Draw/Away': 'Döntetlen/Vendég'
};
const OUTCOME_ORDER = Object.keys(OUTCOME_LABELS);

const SNAPSHOT_KIND_LABELS: Readonly<Record<string, string>> = {
	early: 'korai',
	late: 'késői',
	adhoc: 'eseti',
	opening_csv: 'nyitó',
	closing_csv: 'záró',
	legacy: 'régi'
};

/** Az odds változását ennél kisebb arányban „változatlan”-nak vesszük (kerekítési zaj). */
export const ODDS_MOVE_EPSILON = 0.005;

export const marketLabel = (marketId: number, line?: number | null): string => {
	const base = HISTORY_MARKET_LABELS[marketId] ?? `Piac #${marketId}`;
	return line == null ? base : `${base} ${String(line).replace('.', ',')}`;
};

export const outcomeLabel = (selection: string): string => OUTCOME_LABELS[selection] ?? selection;

export const snapshotKindLabel = (kind?: string): string => (kind ? SNAPSHOT_KIND_LABELS[kind] ?? kind : '');

const outcomeRank = (selection: string): number => {
	const i = OUTCOME_ORDER.indexOf(selection);
	return i < 0 ? OUTCOME_ORDER.length : i;
};

export const oddsMove = (change: number): OddsMove =>
	change > ODDS_MOVE_EPSILON ? 'up' : change < -ODDS_MOVE_EPSILON ? 'down' : 'flat';

/** Változás %-ban, 1 tizedessel, előjellel: `0.052` → `+5,2%`. */
export const formatOddsChange = (change: number): string => `${formatSignedDecimal(change * 100, 1)}%`;

/** Nyitó → legutóbbi szövegként: `2,10 → 2,25`. */
export const formatOddsPath = (row: Pick<IHistoryRow, 'opening' | 'latest'>): string =>
	`${formatOdds(row.opening)} → ${formatOdds(row.latest)}`;

/**
 * Pillanatképek → piacok (id, majd vonal szerint), bennük kimenetenként a legjobb odd időrendben. Egy kimenet csak azokban a
 * pillanatképekben kap pontot, ahol jegyezték; nem pozitív / nem véges odd kimarad.
 */
export function oddsHistoryMarkets(snapshots: readonly IHistorySnapshot[]): IHistoryMarket[] {
	const ordered = [...snapshots].sort((a, b) => Date.parse(a.capturedAt) - Date.parse(b.capturedAt));
	const markets = new Map<string, { marketId: number; line: number | null; rows: Map<string, IHistoryPoint[]> }>();

	for (const snap of ordered) {
		// pillanatképen belül: kimenetenként legjobb odd + jegyző irodák száma
		const best = new Map<string, { marketKey: string; selection: string; point: IHistoryPoint; books: Set<number> }>();
		for (const q of snap.quotes) {
			if (!Number.isFinite(q.odd) || q.odd <= 0) continue;
			const line = q.line ?? null;
			const marketKey = `${q.marketId}|${line ?? ''}`;
			if (!markets.has(marketKey)) markets.set(marketKey, { marketId: q.marketId, line, rows: new Map() });
			const key = `${marketKey}|${q.selection}`;
			const cur = best.get(key);
			if (!cur) {
				best.set(key, {
					marketKey,
					selection: q.selection,
					point: { capturedAt: snap.capturedAt, kind: snap.kind, odd: q.odd, bookmakerId: q.bookmakerId, bookmakerCount: 0 },
					books: new Set([q.bookmakerId])
				});
			} else {
				cur.books.add(q.bookmakerId);
				if (q.odd > cur.point.odd) cur.point = { ...cur.point, odd: q.odd, bookmakerId: q.bookmakerId };
			}
		}
		for (const b of best.values()) {
			const rows = markets.get(b.marketKey)!.rows;
			const points = rows.get(b.selection) ?? [];
			points.push({ ...b.point, bookmakerCount: b.books.size });
			rows.set(b.selection, points);
		}
	}

	return [...markets.entries()]
		.sort(([, a], [, b]) => a.marketId - b.marketId || (a.line ?? -Infinity) - (b.line ?? -Infinity))
		.map(([key, m]) => ({
			key,
			marketId: m.marketId,
			line: m.line,
			label: marketLabel(m.marketId, m.line),
			rows: [...m.rows.entries()]
				.sort(([a], [b]) => outcomeRank(a) - outcomeRank(b) || a.localeCompare(b))
				.map(([selection, points]): IHistoryRow => {
					const opening = points[0].odd;
					const latest = points[points.length - 1].odd;
					const change = latest / opening - 1;
					return {
						key: `${key}|${selection}`,
						selection,
						outcomeLabel: outcomeLabel(selection),
						points,
						opening,
						latest,
						change,
						move: oddsMove(change)
					};
				})
		}));
}
