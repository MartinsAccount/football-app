// `/arbitrage` nézet-modell (S23): tiszta függvények az arbitrázs-pillanatképből (core `ArbitrageSnapshot`).
// A számolás a core-ból jön (`arbitrageStakes`), itt csak szűrés, rendezés és magyar szöveg. S29: a sáv (címke, szűrő,
// számlálók) a kerekített tétekkel számolt `arbitrageStakes(...).band` – „Arbitrázs” csak, ha a legrosszabb kifizetés ≥ összes tét.
import {
	arbitrageStakes,
	formatDecimal,
	formatFt,
	formatKickoff,
	formatOdds,
	formatPairing,
	MINUS,
	type ArbitrageBand,
	type ArbitrageSnapshot
} from '@football/core';

export type BandFilter = ArbitrageBand | 'all';

export interface IArbFilter {
	band: Exclude<BandFilter, 'far'>;
	market: string; // 'all' | piac-kulcs
	bookmaker: string; // 'all' | iroda
}

export const BAND_OPTIONS: { key: IArbFilter['band']; label: string; hint: string }[] = [
	{ key: 'arb', label: 'Arbitrázs', hint: 'Σ 1/odds < 1, és a kerekített tétekkel sem veszít' },
	{ key: 'near', label: 'Közeli', hint: 'Σ 1/odds < 1,02' },
	{ key: 'all', label: 'Mind', hint: 'minden teljesen lefedett piac' }
];

export const BAND_LABEL: Record<ArbitrageBand, string> = { arb: 'Arbitrázs', near: 'Közeli', far: 'Nincs' };

/** Tét-elosztás kerekítése (Ft). Az arbitrázs-hozam tört százalék, ezért durvább kerekítés elviszi a profitot. */
export const STAKE_ROUNDING = 10;
export const DEFAULT_TOTAL_STAKE = 10000;
export const MIN_TOTAL_STAKE = 100;

/** Előjeles százalék 2 tizedessel (az arbitrázs-hozam tipikusan tört százalék): `+0,34%`, `−1,20%`. */
export const formatMarginPct = (ratio: number): string => {
	const pct = Math.round(ratio * 10000) / 100;
	const sign = pct > 0 ? '+' : pct < 0 ? MINUS : '';
	return `${sign}${formatDecimal(Math.abs(pct), 2)}%`;
};

/** Teljesen lefedett piacok a kerekített sávval (`totalStake` Ft, `STAKE_ROUNDING`-ra kerekítve). */
const roundedOpportunities = (snap: ArbitrageSnapshot, totalStake: number) =>
	snap.fixtures.flatMap((f) =>
		f.opportunities
			.filter((o) => o.legs.length > 0 && Number.isFinite(o.sum))
			.map((o) => ({
				f,
				o,
				split: arbitrageStakes(
					o.legs.map((l) => l.odds),
					totalStake,
					STAKE_ROUNDING
				)
			}))
	);

/** Alapszűrő: ha van (kerekítve is) arbitrázs, azt mutatja, különben a közelieket. */
export const defaultFilter = (snap: ArbitrageSnapshot, totalStake = DEFAULT_TOTAL_STAKE): IArbFilter => ({
	band: roundedOpportunities(snap, totalStake).some((x) => x.split.band === 'arb') ? 'arb' : 'near',
	market: 'all',
	bookmaker: 'all'
});

export interface ILegRow {
	outcome: string;
	bookmaker: string;
	odds: string;
	stake: string;
}

export interface IArbRow {
	key: string;
	pairing: string;
	league: string;
	kickoff: string;
	market: string;
	band: ArbitrageBand;
	bandLabel: string;
	sum: string;
	margin: string;
	positive: boolean;
	/** A kerekített tétekkel a legrosszabb kimenet is nyereséges-e. */
	profitPositive: boolean;
	bookmakerCount: number;
	legs: ILegRow[];
	payout: string;
	profit: string;
}

const inBand = (band: ArbitrageBand, filter: IArbFilter['band']) =>
	filter === 'all' ? true : filter === 'near' ? band === 'arb' || band === 'near' : band === 'arb';

/** Szűrt sorok, `Σ` szerint növekvő (a legjobb elöl); teljes lefedés nélküli piac nem kerül a listára. */
export const arbitrageRows = (snap: ArbitrageSnapshot, filter: IArbFilter, totalStake: number): IArbRow[] => {
	const now = new Date(snap.now);
	const marketOf = new Map(snap.markets.map((m) => [m.key, m]));
	return roundedOpportunities(snap, totalStake)
		.filter(({ split }) => inBand(split.band, filter.band))
		.filter(({ o }) => filter.market === 'all' || o.market === filter.market)
		.filter(({ o }) => filter.bookmaker === 'all' || o.legs.some((l) => l.bookmaker === filter.bookmaker))
		.sort((a, b) => a.o.sum - b.o.sum || a.f.kickoff.localeCompare(b.f.kickoff))
		.map(({ f, o, split }) => {
			const market = marketOf.get(o.market);
			const label = (key: string) => market?.outcomes.find((x) => x.key === key)?.label ?? key;
			return {
				key: `${f.fixtureId}-${o.market}`,
				pairing: formatPairing(f.home, f.away),
				league: f.league,
				kickoff: formatKickoff(new Date(f.kickoff), now),
				market: market?.label ?? o.market,
				band: split.band,
				bandLabel: BAND_LABEL[split.band],
				sum: formatDecimal(o.sum, 4),
				margin: formatMarginPct(o.margin),
				positive: o.margin > 0,
				profitPositive: split.profit >= 0,
				bookmakerCount: o.bookmakerCount,
				legs: o.legs.map((l, i) => ({
					outcome: label(l.outcome),
					bookmaker: l.bookmaker,
					odds: formatOdds(l.odds),
					stake: formatFt(split.stakes[i])
				})),
				payout: formatFt(split.worstPayout),
				profit: `${split.profit > 0 ? '+' : split.profit < 0 ? MINUS : ''}${formatFt(Math.abs(split.profit))}`
			};
		});
};

export interface IArbTile {
	label: string;
	value: string;
	foot: string;
	positive?: boolean;
}

/** Összesítő csempék; a számlálók a kerekített sávból (`totalStake` mellett). */
export const arbitrageTiles = (snap: ArbitrageSnapshot, totalStake = DEFAULT_TOTAL_STAKE): IArbTile[] => {
	const opps = roundedOpportunities(snap, totalStake);
	const arbs = opps.filter((x) => x.split.band === 'arb');
	const near = opps.filter((x) => x.split.band === 'near');
	const best = opps.reduce<number | null>((acc, { o }) => (acc === null || o.margin > acc ? o.margin : acc), null);
	return [
		{ label: 'Meccsek', value: String(snap.fixtures.length), foot: `${opps.length} piac teljes lefedéssel` },
		{ label: 'Arbitrázs', value: String(arbs.length), foot: 'a kerekített tétekkel sem veszít', positive: arbs.length > 0 },
		{ label: 'Közeli', value: String(near.length), foot: 'Σ 1/odds < 1,02, vagy a kerekítés viszi el' },
		{
			label: 'Legjobb hozam',
			value: best === null ? '–' : formatMarginPct(best),
			foot: 'elméleti, kerekítés nélkül',
			positive: best !== null && best > 0
		}
	];
};

/** A tét-mező szövegéből pozitív egész Ft; érvénytelennél `null`. */
export const parseTotalStake = (text: string): number | null => {
	const n = Number(text.replace(/[\s ]/g, '').replace(',', '.'));
	return Number.isFinite(n) && n >= MIN_TOTAL_STAKE ? Math.round(n) : null;
};

/** Az oldal alcíme (DESIGN §9 mikrocopy). */
export const ARBITRAGE_SUBTITLE = 'Irodák közötti árkülönbségek';

/**
 * Történeti-adat jelzés (CHANGES 4.) a pillanatkép `source` mezőjéből: a szezon (`2024/25`) és a „nyitó”/„záró” szó onnan
 * jön; ha nincs benne, kimarad. Pl. „Történeti adat: 2024/25 nyitó oddsok – nem megtehető fogadás”.
 */
export const historicalNotice = (source: string): string => {
	const season = source.match(/\b(\d{4}\/\d{2,4})\b/)?.[1];
	const kind = /nyitó/i.test(source) ? 'nyitó' : /záró/i.test(source) ? 'záró' : null;
	const what = [season, kind].filter(Boolean).join(' ');
	return `Történeti adat${what ? `: ${what} oddsok` : ''} – nem megtehető fogadás`;
};

/** Kompakt oldalfej meta-chipjei (CHANGES 1.): alcím, forrás, meccs-, piac- és irodaszám a pillanatképből. */
export const arbitrageHeadChips = (snap: ArbitrageSnapshot): string[] => [
	ARBITRAGE_SUBTITLE,
	snap.source,
	`${snap.fixtures.length} meccs`,
	`${snap.markets.length} piac`,
	`${snap.bookmakers.length} iroda`
];
