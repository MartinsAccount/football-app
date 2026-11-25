import type { FixtureDto, OddsSnapshotDto } from '@football/contract';

/** API-Football bet id 1 = „Match Winner” (1X2). */
export const MATCH_WINNER_MARKET = 1;

/** Egy lejátszott meccs gólokkal és 1X2 oddsokkal – az Odds-statisztika bemenete. */
export interface OddsMatch {
	fixtureId: number;
	leagueId: number;
	goals: { home: number; away: number };
	odds: { home: number; draw: number; away: number };
}

/**
 * `FixtureDto` + legutóbbi odds-pillanatkép → `OddsMatch`. `null`, ha nincs végeredmény vagy nincs olyan fogadóiroda,
 * amelynél mindhárom 1X2-kimenet megvan (a legkisebb bookmaker-id nyer, determinisztikusan).
 */
export function toOddsMatch(fixture: FixtureDto, snapshot: OddsSnapshotDto | null): OddsMatch | null {
	const home = fixture.goalsHome ?? fixture.ftHome;
	const away = fixture.goalsAway ?? fixture.ftAway;
	if (home == null || away == null || !snapshot) return null;

	const byBookmaker = new Map<number, Partial<Record<'Home' | 'Draw' | 'Away', number>>>();
	for (const q of snapshot.quotes) {
		if (q.marketId !== MATCH_WINNER_MARKET || q.line != null) continue;
		if (q.selection !== 'Home' && q.selection !== 'Draw' && q.selection !== 'Away') continue;
		const row = byBookmaker.get(q.bookmakerId) ?? {};
		row[q.selection] = q.odd;
		byBookmaker.set(q.bookmakerId, row);
	}
	const ids = [...byBookmaker.keys()].sort((a, b) => a - b);
	for (const id of ids) {
		const r = byBookmaker.get(id)!;
		if (r.Home && r.Draw && r.Away) {
			return {
				fixtureId: fixture.id,
				leagueId: fixture.leagueId,
				goals: { home, away },
				odds: { home: r.Home, draw: r.Draw, away: r.Away }
			};
		}
	}
	return null;
}

/** Korlátozott párhuzamosságú map (a fixture-enkénti `getOdds` ne nyisson száz kérést egyszerre). */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	};
	await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
	return out;
}
