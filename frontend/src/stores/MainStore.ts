import { action, flow, observable, reaction } from 'mobx';
import { ArbitrageStore } from '../pages/ArbitragePage/stores/ArbitrageStore';
import { FixtureStore } from '../pages/FixturePage/stores/FixtureStore';
import { OddsStore } from '../pages/OddsPage/stores/OddsStore';
import { FetchService } from '../services/FetchService';
import { SettingsStore } from './SettingsStore';
import { SlipStore } from './SlipStore';
import { ThemeStore } from './ThemeStore';

export class MainStore {
	public OddsStore: OddsStore;
	public ArbitrageStore: ArbitrageStore;
	public FixtureStore: FixtureStore;
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
		this.FixtureStore = new FixtureStore(this);
		this.ThemeStore = new ThemeStore();
		this.SettingsStore = new SettingsStore();
		this.SlipStore = new SlipStore(undefined, () => this.SettingsStore.stakeOptions);
		// Alapegység-váltáskor a tét az új egységre áll (a régi lépcső eleme már nem választható).
		reaction(
			() => this.SettingsStore.settings.stakeUnit,
			(unit) => this.SlipStore.setStake(unit)
		);

		this.Init();
	}

	Init = flow(function* (this: MainStore) {
		try {
			yield this.OddsStore.Init();
			// yield this.ArbitrageStore.Init();
			// yield this.FixtureStore.Init();
		} catch (e) {
			console.log('error', e);
		}
	});

	@action increaseFetchNumber() {
		this.fetchNumber += 1;
	}
}
