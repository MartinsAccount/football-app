// Az arbitrázs-mag típusai a core-ban élnek; itt csak továbbexportáljuk a meglévő importok miatt.
import type { IArbitrage, IHighestOdds } from '@football/core';
export type { IArbitrage, IHighestOdds };

export interface IAnalyzedFixture {
	homeTeam?: string;
	awayTeam?: string;
	fixture: number;
	country: string;
	date: string;
	leagueName: string;
	arbitrages: IArbitrage[];
}

export type IFilters = 'goodArbitrage';
