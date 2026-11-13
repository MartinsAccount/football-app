import { formatAge, formatDateRange, RecommendationItem, RecommendationSnapshot, SnapshotOutcome } from '@football/core';
import { ITip } from '../../components/TipCard/tipView';

/** Piac + kimenet Tippmix-nyelven (DESIGN §7.4). */
const TIPPMIX_LABEL: Record<SnapshotOutcome, string> = {
	Home: 'Végeredmény · 1',
	Draw: 'Végeredmény · X',
	Away: 'Végeredmény · 2',
	Over: 'Gólok száma 2,5 · Felett',
	Under: 'Gólok száma 2,5 · Alatt'
};
const MARKET_NAME: Record<RecommendationItem['market'], string> = { h2h: 'Match Winner', ou25: 'Over/Under 2.5' };

/** Pillanatkép-tétel → TipCard nézet-modell (ISO szöveg → Date). */
export const toTip = (item: RecommendationItem): ITip => ({
	id: String(item.fixtureId),
	fixtureId: item.fixtureId,
	league: item.league,
	kickoff: new Date(item.kickoff),
	market: MARKET_NAME[item.market],
	outcome: item.outcome,
	tippmixLabel: TIPPMIX_LABEL[item.outcome],
	pModel: item.pModel,
	pMarket: item.pMarket,
	bestOdds: item.bestOdds,
	bookmaker: item.bookmaker,
	oddsAt: new Date(item.oddsAt),
	minOdds: item.minOdds,
	ev: item.ev,
	confidence: item.confidence,
	warnings: item.warnings,
	reasons: item.reasons,
	stakeUnits: item.stakeUnits,
	modelVersion: item.modelVersion,
	leagueSize: item.leagueSize,
	home: { ...item.home, last5: item.home.last5.map((e) => ({ ...e, date: new Date(e.date) })) },
	away: { ...item.away, last5: item.away.last5.map((e) => ({ ...e, date: new Date(e.date) })) },
	h2h: item.h2h.map((e) => ({ ...e, date: new Date(e.date) }))
});

export interface ITipDay {
	key: 'today' | 'tomorrow';
	title: string;
	tips: ITip[];
}

const TIME_ZONE = 'Europe/Budapest';
const dayKey = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d);

/** „Ma” és „Holnap” csoport a pillanatkép „most”-jához (Budapest); a korábbi/későbbi tételek kimaradnak. Kezdés szerint. */
export const groupTipsByDay = (snapshot: RecommendationSnapshot): ITipDay[] => {
	const now = new Date(snapshot.now);
	const today = dayKey(now);
	const tomorrow = dayKey(new Date(now.getTime() + 24 * 3600 * 1000));
	const tips = snapshot.items.map(toTip).sort((a, b) => a.kickoff.getTime() - b.kickoff.getTime());
	return [
		{ key: 'today', title: 'Ma', tips: tips.filter((t) => dayKey(t.kickoff) === today) },
		{ key: 'tomorrow', title: 'Holnap', tips: tips.filter((t) => dayKey(t.kickoff) === tomorrow) }
	];
};

/** A Ma oldal adat-állapot sora (DESIGN §2 „Az állapot kicsi”): fő pill, mellékchipek, „Mit jelent?” szöveg. */
export interface IDataState {
	/** `.oe-pill--warning`: „Mentett adat · 2025. ápr. 12–13.” */
	label: string;
	/** Mellékchipek, pl. „Odds 17 órás”. */
	chips: string[];
	/** A teljes magyarázat (lenyitva). */
	detail: string;
}

/** Csak akkor van „Sérültlista nincs a forrásban” chip, ha egy tétel figyelmeztetése ezt mondja (nincs beégetett állítás). */
const INJURIES_MISSING = /sérült\S*\s+nincs|nincs\s+sérült/i;

/**
 * Adat-állapot a pillanatképből: a dátumtartomány a tételek kezdési idejéből, az odds kora a legrégebbi `oddsAt`-ból
 * (a pillanatkép `now`-jához). Tétel nélkül csak „Mentett adat”.
 */
export const dataState = (snapshot: RecommendationSnapshot): IDataState => {
	const now = Date.parse(snapshot.now);
	const kickoffs = snapshot.items.map((i) => Date.parse(i.kickoff));
	const oddsTimes = snapshot.items.map((i) => Date.parse(i.oddsAt));
	const range = kickoffs.length ? formatDateRange(new Date(Math.min(...kickoffs)), new Date(Math.max(...kickoffs))) : undefined;
	const age = oddsTimes.length ? formatAge(now - Math.min(...oddsTimes)) : undefined;
	const chips: string[] = [];
	if (age) chips.push(`Odds ${age}`);
	if (snapshot.items.some((i) => i.warnings.some((w) => INJURIES_MISSING.test(w)))) chips.push('Sérültlista nincs a forrásban');
	const facts = [range, `modell: ${snapshot.modelVersion}`, age && `az odds ${age}`].filter(Boolean).join(', ');
	return {
		label: range ? `Mentett adat · ${range}` : 'Mentett adat',
		chips,
		detail: `Az ingyenes API-csomag nem ad idei szezont, ezért a lista mentett adatból készült (${facts}; forrás: ${snapshot.source}). Sérültlista és 5 iroda nincs a forrásban; a tipp a piaccal kombinált becslés.`
	};
};
