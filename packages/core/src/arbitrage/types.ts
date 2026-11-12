export interface IHighestOdds {
	name: string;
	bookmaker: string;
	odd: number;
}

export interface IArbitrage {
	name: string;
	highestOdds: IHighestOdds[] | null;
	arbitrage: number | null; // null: nem támogatott fogadástípus; Infinity: nincs odds
	// betType: BetsNames
}
