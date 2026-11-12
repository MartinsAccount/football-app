export interface IHighestOdds {
	name: string;
	bookmaker: string;
	odd: number;
}

export interface IArbitrage {
	name: string;
	highestOdds: IHighestOdds[];
	arbitrage: number;
	// betType: BetsNames
}
