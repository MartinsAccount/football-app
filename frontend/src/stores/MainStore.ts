import { action, flow, observable, reaction } from 'mobx';
import { ArbitrageStore } from '../pages/ArbitragePage/stores/ArbitrageStore';
import { OddsStore } from '../pages/OddsPage/stores/OddsStore';
import { FetchService } from '../services/FetchService';
import { readApi } from '../services/readApi';
import { localSettingsStorage, SettingsStore } from './SettingsStore';
import { SlipStore } from './SlipStore';
import { ThemeStore } from './ThemeStore';

export class MainStore {
	public OddsStore: OddsStore;
	public ArbitrageStore: ArbitrageStore;
	public SlipStore: SlipStore;
	public SettingsStore: SettingsStore;
	public ThemeStore: ThemeStore;

	public FetchService: FetchService;

	@observable public isLoading: boolean = false;
	@observable public loadingText: string = 'Loading...';

	@observable fetchNumber: number = 0;

	@observable public Sport: string;

	constructor() {
		this.Sport = 'football';
		this.FetchService = new FetchService(this);

		this.OddsStore = new OddsStore(this);
		this.ArbitrageStore = new ArbitrageStore(this);
		this.ThemeStore = new ThemeStore();
		// A szerver (`/api/settings`, :5100) az igazság; a localStorage gyorsítótár / offline tartalék (ROADMAP 2.3, I18a).
		this.SettingsStore = new SettingsStore(localSettingsStorage, {
			load: () => readApi.getSettings(),
			update: (u) => readApi.updateSettings(u),
			leagues: () => readApi.listLeagues().then((r) => r.leagues),
			teams: (leagueId) => readApi.listLeagueTeams(leagueId)
		});
		this.SlipStore = new SlipStore(
			undefined,
			() => this.SettingsStore.stakeOptions,
			(bet) => readApi.createPlacedBet(bet)
		);
		// Alapegység mentésekor (nem a piszkozatban) a tét az új egységre áll (a régi lépcső eleme már nem választható).
		reaction(
			() => this.SettingsStore.saved.stakeUnit,
			(unit) => this.SlipStore.setStake(unit)
		);

		this.Init();
	}

	Init = flow(function* (this: MainStore) {
		try {
			// Az OddsStore lusta: az OddsPage mountjakor tölt az olvasó API-ból (ROADMAP 1.8).
			// yield this.ArbitrageStore.Init();
		} catch (e) {
			console.log('error', e);
		}
	});

	@action increaseFetchNumber() {
		this.fetchNumber += 1;
	}
}
