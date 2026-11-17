import { action, flow, makeObservable, observable, reaction } from 'mobx';
import { OddsStore } from '../pages/OddsPage/stores/OddsStore';
import { readApi } from '../services/readApi';
import { localSettingsStorage, SettingsStore } from './SettingsStore';
import { SlipStore } from './SlipStore';
import { ThemeStore } from './ThemeStore';

export class MainStore {
	public OddsStore: OddsStore;
	public SlipStore: SlipStore;
	public SettingsStore: SettingsStore;
	public ThemeStore: ThemeStore;

	@observable public isLoading: boolean = false;
	@observable public loadingText: string = 'Loading...';

	// A böngésző már nem hív külső API-t (ROADMAP 8.3, I24): a számláló 0 marad. TODO(polish): a BudgetChip `localCalls`-szal együtt kivezetni.
	@observable fetchNumber: number = 0;

	@observable public Sport: string;

	constructor() {
		this.Sport = 'football';
		// MobX 6: a dekorátorok csak ezzel élnek; a mezőknek már létezniük kell (ROADMAP 9.2a).
		makeObservable(this);

		this.OddsStore = new OddsStore(this);
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
		} catch (e) {
			console.log('error', e);
		}
	});

	@action increaseFetchNumber() {
		this.fetchNumber += 1;
	}
}
