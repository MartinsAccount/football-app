import { scanMarket, type ArbitrageFixture, type ArbitrageQuote, type ArbitrageSnapshotMarket } from '@football/core';
import type { ArbitrageResponse } from '@football/contract';
import type { SqlExecutor } from '@football/db';

/**
 * Arbitrázs a tárolt odds-snapshotokból (I22, ROADMAP 8.1): a közelgő meccsek legutóbbi (`captured_at ≤ now`) snapshotjának
 * `odds_quote` soraiból irodák közti pásztázás a core `scanMarket`-tel. 0 API-hívás. A kimenet a `GET /api/arbitrage`
 * drótformája (`ArbitrageResponse`, `Infinity` → `null`), így a web és a mobil változatlanul olvassa.
 * TODO(polish): `odds_best` (minden iroda, nem csak a tárolt kör) bevonása, ha a legjobb iroda ismert és fogadható;
 * több gólvonal (8.3), meccs-id szűrés a mobil 8.2-höz.
 */

/** A pásztázott piacok: DB piac-id + vonal → a CSV-pillanatkép (S23) kulcsai/címkéi. */
export const ARBITRAGE_MARKETS: (ArbitrageSnapshotMarket & { marketId: number; line: number | null })[] = [
	{
		key: 'h2h',
		label: 'Végeredmény',
		marketId: 1,
		line: null,
		outcomes: [
			{ key: 'Home', label: 'Hazai' },
			{ key: 'Draw', label: 'Döntetlen' },
			{ key: 'Away', label: 'Vendég' }
		]
	},
	{
		key: 'ou25',
		label: 'Gólok 2,5',
		marketId: 5,
		line: 2.5,
		outcomes: [
			{ key: 'Over', label: 'Több mint 2,5' },
			{ key: 'Under', label: 'Kevesebb mint 2,5' }
		]
	}
];

/** Alapablak: a következő 10 nap (két forduló), mint a CSV-pillanatképnél. */
export const ARBITRAGE_WINDOW_DAYS = 10;
const DAY = 86_400_000;

/** Egy quote-sor a lekérdezésből (snapshot nélküli meccs nem jön). */
export interface ArbitrageQuoteRow {
	fixture_id: number;
	league: string;
	kickoff: unknown;
	home: string;
	away: string;
	odds_at: unknown;
	bookmaker: string;
	market_id: number;
	selection: string;
	line: number | null;
	odd: number;
}

const iso = (x: unknown) => new Date(x as string).toISOString();

/** Tiszta: quote-sorok → drótformájú pillanatkép; üres bemenet → `null`. */
export function buildArbitrageResponse(rows: ArbitrageQuoteRow[], now: Date, source: string): ArbitrageResponse | null {
	if (!rows.length) return null;
	const byFixture = new Map<number, ArbitrageQuoteRow[]>();
	for (const r of rows) byFixture.set(r.fixture_id, [...(byFixture.get(r.fixture_id) ?? []), r]);
	const bookmakers = new Set<string>();
	const fixtures: ArbitrageFixture[] = [...byFixture.values()].map((quotes) => {
		const f = quotes[0];
		return {
			fixtureId: f.fixture_id,
			league: f.league,
			kickoff: iso(f.kickoff),
			home: f.home,
			away: f.away,
			oddsAt: iso(f.odds_at),
			opportunities: ARBITRAGE_MARKETS.map((m) => {
				const marketQuotes: ArbitrageQuote[] = quotes
					.filter((q) => q.market_id === m.marketId && (m.line === null ? q.line === null : q.line === m.line))
					.map((q) => ({ bookmaker: q.bookmaker, outcome: q.selection, odds: q.odd }));
				const opp = scanMarket(
					m.key,
					m.outcomes.map((o) => o.key),
					marketQuotes
				);
				for (const q of marketQuotes) if (m.outcomes.some((o) => o.key === q.outcome)) bookmakers.add(q.bookmaker);
				return opp;
			})
		};
	});
	fixtures.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.fixtureId - b.fixtureId);
	return {
		generatedAt: now.toISOString(),
		now: now.toISOString(),
		source,
		markets: ARBITRAGE_MARKETS.map(({ key, label, outcomes }) => ({ key, label, outcomes })),
		bookmakers: [...bookmakers].sort((a, b) => a.localeCompare(b)),
		fixtures: fixtures.map((f) => ({
			...f,
			opportunities: f.opportunities.map((o) => ({ ...o, sum: Number.isFinite(o.sum) ? o.sum : null }))
		}))
	};
}

export interface ArbitrageLoadOptions {
	now: Date;
	days?: number;
}

/**
 * A közelgő (`NS`/`TBD`, `now ≤ kickoff < now + days`) meccsek a bekapcsolt követett ligákban (ha nincs követett liga:
 * minden liga), meccsenként a legutóbbi `captured_at ≤ now` snapshot quote-jaival. Nincs ilyen meccs → `null`.
 */
export async function loadArbitrageSnapshot(db: SqlExecutor, opts: ArbitrageLoadOptions): Promise<ArbitrageResponse | null> {
	const { now, days = ARBITRAGE_WINDOW_DAYS } = opts;
	const { rows } = await db.query<ArbitrageQuoteRow>(
		`WITH fl AS (SELECT league_id FROM followed_league WHERE enabled),
		fx AS (
			SELECT f.* FROM fixture f
			WHERE f.status IN ('NS', 'TBD') AND f.kickoff_at >= $1::timestamptz AND f.kickoff_at < $2::timestamptz
				AND (NOT EXISTS (SELECT 1 FROM followed_league) OR f.league_id IN (SELECT league_id FROM fl))
		), s AS (
			SELECT DISTINCT ON (o.fixture_id) o.id, o.fixture_id, o.captured_at FROM odds_snapshot o JOIN fx ON fx.id = o.fixture_id
			WHERE o.captured_at <= $1::timestamptz ORDER BY o.fixture_id, o.captured_at DESC, o.id DESC
		)
		SELECT fx.id::float8 AS fixture_id, l.name AS league, fx.kickoff_at AS kickoff, ht.name AS home, at.name AS away,
			s.captured_at AS odds_at, b.name AS bookmaker, q.market_id::float8 AS market_id, q.selection, q.line::float8 AS line,
			q.odd::float8 AS odd
		FROM s JOIN fx ON fx.id = s.fixture_id
			JOIN league l ON l.id = fx.league_id
			JOIN team ht ON ht.id = fx.home_team_id
			JOIN team at ON at.id = fx.away_team_id
			JOIN odds_quote q ON q.snapshot_id = s.id
			JOIN bookmaker b ON b.id = q.bookmaker_id
		ORDER BY fx.kickoff_at, fx.id, b.name`,
		[now.toISOString(), new Date(now.getTime() + days * DAY).toISOString()]
	);
	return buildArbitrageResponse(rows, now, 'DB odds-snapshot (legutóbbi, tárolt irodák)');
}
