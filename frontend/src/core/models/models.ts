import type { Bet, BetsNames, BetsValue, Bookmaker } from '@football/core';
// Az odds-típusok a @football/core csomagban élnek; itt a meglévő importok miatt továbbexportáljuk.
export type { Bet, BetsNames, BetsValue, Bookmaker };

export type Countries = 'england' | 'germany' | 'france' | 'spain' | 'italy';

export interface currentFixture {
	[key: string]: Fixture[];
}

export type StatisticsType =
	| 'Shots on Goal'
	| 'Shots off Goal'
	| 'Total Shots'
	| 'Blocked Shots'
	| 'Shots insidebox'
	| 'Fouls'
	| 'Corner Kicks'
	| 'Offsides'
	| 'Ball Possession' // string
	| 'Yellow Cards'
	| 'Red Cards'
	| 'Goalkeeper Saves'
	| 'Passes accurate'
	| 'Passes %'; // string

export interface IBetsTypes {
	[key: string]: BetsNames;
}

export interface Statistics {
	type: StatisticsType;
	value: number | string;
}

export interface Fixture {
	fixture: {
		id: number; //!
		date: string;
	};
	goals: {
		home: number; //!
		away: number; //!
	};
	league: {
		id: number;
		name: string;
		country: string;
	};
	score: {
		halftime: { home: number; away: number };
		fulltime: { home: number; away: number };
		penalty: { home: number; away: number };
	};
	teams: {
		away: {
			id: number; //!
			name: string;
			winner: boolean;
			logo: string;
		};
		home: {
			id: number; //!
			name: string;
			winner: boolean;
			logo: string;
		};
	};
}

export interface Fixtures {
	parameters: {
		season: string;
		league: string;
		round: string;
	};
	response: Fixture[];
	results: number;
}

export interface OddsResponse {
	bookmakers: Bookmaker;
	fixture: {
		id: number;
		timezone: string;
		date: string;
		timestamp: string;
	};
	league: {
		id: number;
		name: string;
		country: string;
		logo: string;
		flag: string;
		season: number;
	};
	update: string;
}

// export interface OddsInfo {
// 	sum: number;
// 	favoriteWin: number;
// 	unFavoriteWin: number;
// 	smallOdd: {
// 		home: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 		away: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 	};
// 	midOdd: {
// 		home: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 		away: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 	};
// 	highOdd: {
// 		home: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 		away: {
// 			sum: number;
// 			win: number;
// 			draw: number;
// 			lose: number;
// 		};
// 	};
// }
