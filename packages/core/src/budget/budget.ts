// Hívás- és tárhelybecslés (api-football.md §6, architecture.md §4/§4.1). Tiszta függvények; a /settings (S22) mutatja.

export const DAILY_CALL_LIMIT = 100;
export const STORAGE_LIMIT_BYTES = 500 * 1024 * 1024;

export interface LeagueRoundInput {
	/** Meccsek fordulónként (top liga: 10). */
	fixturesPerRound?: number;
	/** Meccsnapok fordulónként (jellemzően 2–3) – ennyi késői odds-snapshot. */
	matchDaysPerRound?: number;
	/** `/predictions` hívás jelöltenként (opcionális). */
	predictionCandidates?: number;
	/** Eredmény-lekérő körök (a 48 órás késés miatt lehet 2). */
	resultPasses?: number;
}

export interface LeagueRoundCalls {
	fixtures: number;
	standings: number;
	earlyOdds: number;
	lateOdds: number;
	injuries: number;
	results: number;
	predictions: number;
	total: number;
}

/** `/odds` 10 meccs/oldal; `fixtures?ids=` és `injuries?ids=` ≤ 20 meccs/hívás. */
const ODDS_PAGE_SIZE = 10;
const IDS_BATCH = 20;

const assertNonNegative = (xs: readonly number[]) => {
	for (const x of xs) if (!(x >= 0)) throw new Error('A becslés bemenete nem lehet negatív.');
};

/** Hívás / liga / forduló a §6.2 táblázat szerint. */
export const estimateLeagueCallsPerRound = (input: LeagueRoundInput = {}): LeagueRoundCalls => {
	const { fixturesPerRound = 10, matchDaysPerRound = 2.5, predictionCandidates = 0, resultPasses = 1 } = input;
	assertNonNegative([fixturesPerRound, matchDaysPerRound, predictionCandidates, resultPasses]);
	const batches = Math.ceil(fixturesPerRound / IDS_BATCH);
	const calls = {
		fixtures: 1,
		standings: 1,
		earlyOdds: Math.max(1, Math.ceil(fixturesPerRound / ODDS_PAGE_SIZE)),
		lateOdds: matchDaysPerRound,
		injuries: batches,
		results: batches * resultPasses,
		predictions: predictionCandidates
	};
	return { ...calls, total: Object.values(calls).reduce((s, x) => s + x, 0) };
};

export interface DailyCallOptions {
	/** Átlagos forduló/hét (1, néha 2 → 1,3). */
	roundsPerWeek?: number;
	/** Közös heti költség (`/leagues` heti 1, `/odds/bookmakers` + `/odds/bets` havi 1–1 ≈ 0,5/hét). */
	sharedWeekly?: number;
	/** A forduló hívásainak mekkora része esik a csúcsnapra (péntek–szombat). */
	peakDayShare?: number;
	dailyLimit?: number;
}

export interface DailyCallEstimate {
	perLeague: LeagueRoundCalls[];
	perRound: number;
	weekly: number;
	dailyAverage: number;
	peakDay: number;
	/** Átlagnapon backfillre maradó hívás. */
	remainingAverage: number;
	/** A csúcsnap túllépi a napi keretet. */
	overLimit: boolean;
}

/** Napi kép N ligára (§6.3). */
export const estimateDailyCalls = (leagues: readonly LeagueRoundInput[], options: DailyCallOptions = {}): DailyCallEstimate => {
	const { roundsPerWeek = 1.3, sharedWeekly = 1.5, peakDayShare = 0.6, dailyLimit = DAILY_CALL_LIMIT } = options;
	assertNonNegative([roundsPerWeek, sharedWeekly, peakDayShare, dailyLimit]);
	const perLeague = leagues.map((l) => estimateLeagueCallsPerRound(l));
	const perRound = perLeague.reduce((s, l) => s + l.total, 0);
	const weekly = perRound * roundsPerWeek + sharedWeekly;
	const dailyAverage = weekly / 7;
	const peakDay = perRound * peakDayShare;
	return {
		perLeague,
		perRound,
		weekly,
		dailyAverage,
		peakDay,
		remainingAverage: dailyLimit - dailyAverage,
		overLimit: peakDay > dailyLimit
	};
};

export interface OddsStorageInput {
	/** Meccsek szezononként (a követett ligák összesen; top liga: 380). */
	fixturesPerSeason: number;
	/** Megőrzött snapshot meccsenként (retention: nyitó + záró = 2). */
	snapshotsPerFixture: number;
	/** Tárolt irodák száma. */
	bookmakers: number;
	/** Kimenetek összesen a tárolt piacokon (1X2 = 3, O/U 2.5 = 2, BTTS = 2 → 7). */
	outcomes: number;
	/** Bájt soronként, indexszel együtt. */
	bytesPerRow?: number;
	limitBytes?: number;
}

export interface OddsStorageEstimate {
	rows: number;
	bytes: number;
	/** Egy szezon a tárhelykeret hányad része. */
	shareOfLimit: number;
	/** Ennyi szezon fér a keretbe. */
	seasonsInLimit: number;
}

/** `odds_quote` sorok és bájt / szezon (architecture.md §4): meccs × snapshot × iroda × kimenet. */
export const estimateOddsStorage = (input: OddsStorageInput): OddsStorageEstimate => {
	const {
		fixturesPerSeason,
		snapshotsPerFixture,
		bookmakers,
		outcomes,
		bytesPerRow = 150,
		limitBytes = STORAGE_LIMIT_BYTES
	} = input;
	assertNonNegative([fixturesPerSeason, snapshotsPerFixture, bookmakers, outcomes, bytesPerRow]);
	const rows = fixturesPerSeason * snapshotsPerFixture * bookmakers * outcomes;
	const bytes = rows * bytesPerRow;
	return { rows, bytes, shareOfLimit: bytes / limitBytes, seasonsInLimit: bytes === 0 ? Infinity : limitBytes / bytes };
};
