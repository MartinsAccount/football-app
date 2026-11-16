// `odds_best` (ROADMAP 3.5b, architecture.md §4.1): a teljes lekért válaszból (iroda-szűrés ELŐTT) kimenetenként a legjobb és
// az átlag odds. Tiszta függvény; a tárolási szűrés (`isQuoteStored`) csak utána jön, így a `maxOdd`-ot nem befolyásolja.
// A `model/market.ts` `bestOdds`-a igazított tömbökön (iroda × kimenet) dolgozik; itt lapos, kulcsolt quote-lista a bemenet.

export interface BestOddsQuote {
	bookmakerId: number;
	marketId: number;
	selection: string;
	line?: number | null;
	odd: number;
}

export interface BestOddsRow {
	marketId: number;
	selection: string;
	line: number | null;
	/** A legmagasabb odds a kimenetre (holtversenynél az első iroda nyer). */
	maxOdd: number;
	/** A `maxOdd` irodája. */
	bookmakerId: number;
	/** Az irodánkénti oddsok számtani átlaga (kerekítés nélkül; a DB `numeric(7,3)`-ra kerekít). */
	avgOdd: number;
	/** Hány iroda jegyzi a kimenetet. */
	nBooks: number;
}

/**
 * Kimenetenként (piac, kimenet, vonal) a legjobb és az átlag odds. Irodánként kimenetre csak az első érvényes (`odd > 1`)
 * jegyzés számít; a sorrend az első előfordulásé.
 */
export function computeBestOdds(quotes: readonly BestOddsQuote[]): BestOddsRow[] {
	const groups = new Map<string, { row: BestOddsRow; sum: number; books: Set<number> }>();
	for (const q of quotes) {
		if (!(Number.isFinite(q.odd) && q.odd > 1)) continue;
		const line = q.line ?? null;
		const key = `${q.marketId}|${q.selection}|${line}`;
		const g = groups.get(key);
		if (!g) {
			const row = {
				marketId: q.marketId,
				selection: q.selection,
				line,
				maxOdd: q.odd,
				bookmakerId: q.bookmakerId,
				avgOdd: 0,
				nBooks: 0
			};
			groups.set(key, { row, sum: q.odd, books: new Set([q.bookmakerId]) });
			continue;
		}
		if (g.books.has(q.bookmakerId)) continue;
		g.books.add(q.bookmakerId);
		g.sum += q.odd;
		if (q.odd > g.row.maxOdd) {
			g.row.maxOdd = q.odd;
			g.row.bookmakerId = q.bookmakerId;
		}
	}
	return [...groups.values()].map(({ row, sum, books }) => ({ ...row, avgOdd: sum / books.size, nBooks: books.size }));
}
