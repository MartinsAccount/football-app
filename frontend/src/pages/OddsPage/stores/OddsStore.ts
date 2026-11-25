import { action, computed, flow, makeObservable, observable } from 'mobx';
import { MainStore } from '../../../stores/MainStore';
import { ITableRow } from '../models/ITableRow';
import { ODDS_INFO } from '../constants/oddsInfo';
import { DRAW_INFO } from '../constants/drawInfo';
import { LEAGUES } from '../../../core/constants/Leagues';
import OddsService from '../services/OddsService';
import { OddsMatch } from '../services/oddsMatch';

type ICurruntLeagues = 'england' | 'germany' | 'france' | 'italy' | 'spain' | 'all';
type LeagueKey = Exclude<ICurruntLeagues, 'all'>;

const LEAGUE_IDS: Record<LeagueKey, number> = {
	england: LEAGUES.ENGLAND,
	germany: LEAGUES.GERMANY,
	france: LEAGUES.FRANCE,
	italy: LEAGUES.ITALY,
	spain: LEAGUES.SPAIN
};

export class OddsStore {
	@observable public MainStore: MainStore;
	// public OddsService: OddsService;
	/** Ligánként a lejátszott meccsek 1X2 oddsokkal (olvasó API, ROADMAP 1.8). */
	@observable Matches: Partial<Record<LeagueKey, OddsMatch[]>> = undefined;
	@observable loadError: string = null;

	@observable oddsInfos: typeof ODDS_INFO;
	@observable drawInfos: typeof DRAW_INFO;

	@observable currentLeague: ICurruntLeagues = undefined;

	constructor(MainStore: MainStore) {
		this.MainStore = MainStore;

		this.oddsInfos = { ...ODDS_INFO };
		this.drawInfos = { ...DRAW_INFO };
		makeObservable(this);
	}

	/** Lusta betöltés: az OddsPage mountjakor fut (nem az app indulásakor), egyszer. */
	Init = flow(function* (this: OddsStore) {
		if (this.Matches) return;
		this.MainStore.isLoading = true;
		this.loadError = null;

		try {
			const keys = Object.keys(LEAGUE_IDS) as LeagueKey[];
			const lists: OddsMatch[][] = yield Promise.all(keys.map((k) => OddsService.loadLeagueMatches(LEAGUE_IDS[k])));
			const matches: Partial<Record<LeagueKey, OddsMatch[]>> = {};
			keys.forEach((k, i) => (matches[k] = lists[i]));
			this.Matches = matches;
			if (this.currentLeague) this.changeLeague(this.currentLeague);
		} catch (e) {
			this.loadError = e instanceof Error ? e.message : String(e);
			console.log('OddsStore.Init error', e);
		} finally {
			this.MainStore.isLoading = false;
		}
	});

	@action changeLeague(league: ICurruntLeagues) {
		this.currentLeague = league;

		this.oddsInfos = { ...ODDS_INFO };
		this.drawInfos = { ...DRAW_INFO };

		this.analyzeOddsInfos();
	}

	@action analyzeOddsInfos() {
		this.getCurrentMatches.forEach((m: OddsMatch) => {
			const homeIsFavorite = m.odds.home <= m.odds.away;
			const favorite: 'home' | 'away' = homeIsFavorite ? 'home' : 'away';
			const unFavorite: 'home' | 'away' = homeIsFavorite ? 'away' : 'home';
			const favoriteOdd = m.odds[favorite];
			const unFavoriteOdd = m.odds[unFavorite];

			const winFavorite: boolean = m.goals[favorite] > m.goals[unFavorite];
			const isDraw: boolean = m.goals.home === m.goals.away;
			let winner: 'home' | 'away';
			if (m.goals.home > m.goals.away) winner = 'home';
			if (m.goals.home < m.goals.away) winner = 'away';

			this.changeOddsInfos(favorite, winFavorite, favoriteOdd, isDraw);

			if (favoriteOdd > 2 && unFavoriteOdd > 2) this.changeOverOddsInfos(winner, favoriteOdd, unFavoriteOdd, isDraw);
			if (isDraw) this.changeDrawInfos(favoriteOdd, favorite, m.goals.home > 0);
		});
	}

	@action changeDrawInfos(favoriteOdd: number, favorite: 'home' | 'away', wasGoal: boolean) {
		this.drawInfos.sum += 1;

		if (favoriteOdd > 2) {
			this.drawInfos.drawWhenNoOneFavorite += 1;
			if (favorite === 'home') this.drawInfos.drawWhenHomeFavorite += 1;
			if (favorite === 'away') this.drawInfos.drawWhenAwayFavorite += 1;
		} else {
			if (favorite === 'home') this.drawInfos.drawWhenHomeFavorite += 1;
			if (favorite === 'away') this.drawInfos.drawWhenAwayFavorite += 1;
		}

		if (wasGoal) {
			this.drawInfos.drawWithGoals += 1;
		} else {
			this.drawInfos.drawWithoutGoals += 1;
		}
	}

	@action changeOverOddsInfos(winner: 'home' | 'away', favoriteOdd: number, unFavoriteOdd: number, isDraw: boolean) {
		const _oddsInfos = { ...this.oddsInfos };

		_oddsInfos.overOdds.bothOver200.sum += 1;
		if (favoriteOdd > 2.25 && unFavoriteOdd > 2.25) _oddsInfos.overOdds.bothOver225.sum += 1;
		if (favoriteOdd > 2.5 && unFavoriteOdd > 2.5) _oddsInfos.overOdds.bothOver250.sum += 1;
		if (favoriteOdd > 2.7 && unFavoriteOdd > 2.7) _oddsInfos.overOdds.bothOver270.sum += 1;

		if (isDraw) {
			_oddsInfos.overOdds.bothOver200.draw += 1;
			if (favoriteOdd > 2.25 && unFavoriteOdd > 2.25) _oddsInfos.overOdds['bothOver225'].draw += 1;
			if (favoriteOdd > 2.5 && unFavoriteOdd > 2.5) _oddsInfos.overOdds['bothOver250'].draw += 1;
			if (favoriteOdd > 2.7 && unFavoriteOdd > 2.7) _oddsInfos.overOdds['bothOver270'].draw += 1;
		} else {
			_oddsInfos.overOdds.bothOver200[winner] += 1;
			if (favoriteOdd > 2.25 && unFavoriteOdd > 2.25) _oddsInfos.overOdds.bothOver225[winner] += 1;
			if (favoriteOdd > 2.5 && unFavoriteOdd > 2.5) _oddsInfos.overOdds.bothOver250[winner] += 1;
			if (favoriteOdd > 2.7 && unFavoriteOdd > 2.7) _oddsInfos.overOdds.bothOver270[winner] += 1;
		}

		this.oddsInfos = _oddsInfos;
	}

	@action changeOddsInfos(favorite: 'home' | 'away', winFavorite: boolean, favoriteOdd: number, isDraw: boolean) {
		const _oddsInfos = { ...this.oddsInfos };

		let oddSize: 'smallOdd' | 'midOdd' | 'highOdd';
		if (favoriteOdd <= 1.5) oddSize = 'smallOdd';
		if (favoriteOdd <= 1.9 && favoriteOdd > 1.5) oddSize = 'midOdd';
		if (favoriteOdd > 1.9) oddSize = 'highOdd';

		_oddsInfos.sum += 1;
		if (winFavorite) {
			_oddsInfos.favoriteWin += 1;
		} else if (isDraw) {
			_oddsInfos.draw += 1;
		} else {
			_oddsInfos.unFavoriteWin += 1;
		}

		// change object
		_oddsInfos[oddSize][favorite].sum += 1;
		if (isDraw) {
			_oddsInfos[oddSize][favorite].draw += 1;
		} else {
			if (winFavorite === true) _oddsInfos[oddSize][favorite].win += 1;
			if (winFavorite === false) _oddsInfos[oddSize][favorite].lose += 1;
		}

		this.oddsInfos = _oddsInfos;
	}

	@computed get getCurrentMatches(): OddsMatch[] {
		if (!this.currentLeague || !this.Matches) return [];
		if (this.currentLeague === 'all') return Object.values(this.Matches).flat();
		return this.Matches[this.currentLeague] ?? [];
	}

	@computed get getTableRows() {
		let arr = ['smallOdd', 'midOdd', 'highOdd'];
		let titles = ['Hazai 1,5 alatt', 'Hazai 1,5 - 1,9 között', 'Hazai 1,9 felett'];
		let both = ['bothOver200', 'bothOver225', 'bothOver250', 'bothOver270'];
		let diff = ['Differencia 0 - 0,5', 'Differencia 0,5 - 1', 'Differencia 1 - 1,5'];

		const rows: ITableRow[] = [
			{ title: 'Esélyesebb nyert', data: this.oddsInfos.favoriteWin, onCustomData: this.oddsInfos.sum },
			{ title: 'Esélytelenebb nyert', data: this.oddsInfos.unFavoriteWin, onCustomData: this.oddsInfos.sum },
			{ title: 'Döntetlen', data: this.oddsInfos.draw, onCustomData: this.oddsInfos.sum },
			...arr.map((it, index) => {
				return {
					title: titles[index],
					GY: this.oddsInfos[it].home.win,
					D: this.oddsInfos[it].home.draw,
					V: this.oddsInfos[it].home.lose,
					onCustomData: this.oddsInfos[it].home.sum
				};
			}),
			...arr.map((it, index) => {
				return {
					title: titles[index].replace('Hazai', 'Vendég'),
					GY: this.oddsInfos[it].away.win,
					D: this.oddsInfos[it].away.draw,
					V: this.oddsInfos[it].away.lose,
					onCustomData: this.oddsInfos[it].away.sum
				};
			}),
			...both.map((it, index) => {
				return {
					title: `Mindkető ${it[8]},${it[9]} felett (H-D-V)`,
					GY: this.oddsInfos.overOdds[it].home,
					D: this.oddsInfos.overOdds[it].draw,
					V: this.oddsInfos.overOdds[it].away,
					onCustomData: this.oddsInfos.overOdds[it].sum
				};
			}),
			{ title: 'Döntetlen (hazai az esélyesebb)', data: this.drawInfos.drawWhenHomeFavorite, onCustomData: this.drawInfos.sum },
			{ title: 'Döntetlen (vendég az esélyesebb)', data: this.drawInfos.drawWhenAwayFavorite, onCustomData: this.drawInfos.sum },
			{
				title: 'Döntetlen (mindkettő 2-es odds felett)',
				data: this.drawInfos.drawWhenNoOneFavorite,
				onCustomData: this.drawInfos.sum
			}
		];

		return rows;
	}

	//TODO: Odds-ot figyelembe véve
	//? Ha döntetlen akkor mennyi volt a két odds közötti különbség
	//? Döntetlen úgy hogy a vendégen volt kisebb az odds és akkor mennyi volt
	//? Döntetlen úgy hogy a hazai-n kisebb az odds és úgy mennyi volt
	//? Első félidőbe vezet a nagyobb odds-ú akkor mi lesz a végeredmény / Hazai és Vendég viszonylatban

	//TODO: Mindkét csapat gól
	//? Tényezők amik befolyásolhatják:
	//? Előző 5 meccsen emnnyi gólt lőttek
	//? Otthon vagy idegenben a favorite csapat
	//? Odds különsbég
}
