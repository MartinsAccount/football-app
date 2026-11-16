import { action, computed, observable, runInAction } from 'mobx';
import {
	formatPairing,
	ISavedSlip,
	loadStoredSync,
	saveStoredSync,
	savedSlipsCodec,
	hasFixture,
	parseOddsInput,
	PlacedBetDraft,
	slipToPlacedBet,
	SlipLeg,
	SlipSummary,
	summarizeSlip,
	transferStatus,
	TransferStatus
} from '@football/core';
import { ITip } from '../components/TipCard/tipView';
import { webStorage } from '../shared/storage/webStorage';

/** Alap tét-lépcső Ft-ban (DESIGN §7.6); az appban a `SettingsStore.stakeOptions` adja. */
export const STAKE_OPTIONS = [500, 1000, 2000, 5000] as const;
export const DEFAULT_STAKE = 1000;

/** Tippmixre vitel egy sora (DESIGN §7.7). */
export interface ITransferRow {
	tip: ITip;
	input: string;
	tippmixOdds: number | null;
	status: TransferStatus;
}

export type { ISavedSlip } from '@football/core';

/** A mentett szelvények tárolója; a DB-s írás (bet tábla) a backend-íróval jön. */
export interface ISlipStorage {
	load(): ISavedSlip[];
	save(slips: ISavedSlip[]): void;
}

/** localStorage (`oe_saved_slips`) a core `savedSlipsCodec`-kel; szinkron olvasás, az írási hiba a hívóé (mint eddig). */
export const localSlipStorage: ISlipStorage = {
	load: () => loadStoredSync(webStorage, savedSlipsCodec),
	save: (slips) => saveStoredSync(webStorage, savedSlipsCodec, slips)
};

/** Egy szingli szelvény rögzítése a szerveren (`POST /api/bets`, I23b); a szerver-oldali id-t adja vissza. */
export type RecordBet = (bet: PlacedBetDraft) => Promise<{ id: number }>;

export const memorySlipStorage = (initial: ISavedSlip[] = []): ISlipStorage => {
	let slips = initial;
	return { load: () => slips, save: (next) => (slips = next) };
};

/**
 * Szelvény (DESIGN §7.6–7.7, PRD 7.3): kijelölt tippek, tét, beírt Tippmix-odds, mentés.
 * Minden képlet a `@football/core` slip-magjából jön.
 */
export class SlipStore {
	@observable.shallow tips: ITip[] = [];
	@observable stake: number = DEFAULT_STAKE;
	@observable inputs = observable.map<string, string>();
	@observable transferOpen = false;
	/** Mobilon (< 640 px) nyitva van-e az alsó lap. */
	@observable.shallow saved: ISavedSlip[];
	/** Az utoljára mentett szelvény azonosítója (visszajelzéshez). */
	@observable lastSavedId: string | null = null;

	constructor(
		private storage: ISlipStorage = localSlipStorage,
		private getStakeOptions: () => readonly number[] = () => STAKE_OPTIONS,
		private recordBet?: RecordBet
	) {
		this.saved = storage.load();
		this.stake = this.stakeOptions[1] ?? DEFAULT_STAKE;
	}

	/** Tét-lépcső (az appban a `/settings` alapegységéből). */
	@computed get stakeOptions(): readonly number[] {
		return this.getStakeOptions();
	}

	isSelected = (tipId: string): boolean => this.tips.some((t) => t.id === tipId);

	/** Miért nem tehető fel a tipp (egy meccs = egy tipp); undefined, ha feltehető vagy már fent van. */
	blockedReason = (tip: ITip): string | undefined =>
		!this.isSelected(tip.id) && hasFixture(this.legs, tip.fixtureId) ? 'Erről a meccsről már van tipp a szelvényen.' : undefined;

	@computed get legs(): SlipLeg[] {
		return this.tips.map((tip) => {
			const tippmixOdds = parseOddsInput(this.inputs.get(tip.id) ?? '');
			return { fixtureId: tip.fixtureId, pModel: tip.pModel, bestOdds: tip.bestOdds, tippmixOdds: tippmixOdds ?? undefined };
		});
	}

	@computed get summary(): SlipSummary | null {
		return summarizeSlip(this.legs, this.stake);
	}

	@computed get transferRows(): ITransferRow[] {
		return this.tips.map((tip) => {
			const input = this.inputs.get(tip.id) ?? '';
			const tippmixOdds = parseOddsInput(input);
			return { tip, input, tippmixOdds, status: transferStatus(tippmixOdds, tip.minOdds) };
		});
	}

	/** Menthető, ha minden lábhoz van érvényes beírt odds. A min. alatti láb mentése a felhasználó döntése. */
	@computed get canSave(): boolean {
		return this.tips.length > 0 && this.transferRows.every((r) => r.status !== 'missing');
	}

	@action toggle(tip: ITip) {
		if (this.isSelected(tip.id)) return this.remove(tip.id);
		if (this.blockedReason(tip)) return;
		this.tips = [...this.tips, tip];
		this.lastSavedId = null;
	}

	@action remove(tipId: string) {
		this.tips = this.tips.filter((t) => t.id !== tipId);
		this.inputs.delete(tipId);
		if (this.tips.length === 0) this.transferOpen = false;
	}

	/** Kész szelvény (SlipPresets, DESIGN §7.8) betöltése: lecseréli a lábakat, utána szabadon szerkeszthető. */
	@action applyPreset(tips: readonly ITip[]) {
		const legs: ITip[] = [];
		for (const tip of tips) if (!legs.some((l) => l.fixtureId === tip.fixtureId)) legs.push(tip);
		this.tips = legs;
		this.inputs.clear();
		this.transferOpen = false;
		this.lastSavedId = null;
	}

	/** Igaz, ha a szelvény pontosan ezekből a tippekből áll (a kiválasztott preset jelölése). */
	hasExactly = (tipIds: readonly string[]): boolean =>
		tipIds.length === this.tips.length && tipIds.every((id) => this.isSelected(id));

	/** „Szelvény ürítése” (DESIGN v0.2 §6): minden láb és beírt odds le; a panel a presetekhez tér vissza. */
	@action clear() {
		this.tips = [];
		this.inputs.clear();
		this.transferOpen = false;
	}

	@action setStake(stake: number) {
		this.stake = stake;
	}

	@action setTippmixInput(tipId: string, value: string) {
		this.inputs.set(tipId, value);
	}

	@action openTransfer() {
		if (this.tips.length) this.transferOpen = true;
	}

	@action closeTransfer() {
		this.transferOpen = false;
	}

	/** „Megtettem – szelvény mentése”: elmenti a beírt oddsokkal és téttel, majd üríti a szelvényt. */
	@action save(now: Date = new Date()): ISavedSlip | null {
		const summary = this.summary;
		if (!this.canSave || !summary) return null;
		const slip: ISavedSlip = {
			id: `slip-${now.getTime()}`,
			savedAt: now.toISOString(),
			stake: this.stake,
			combinedOdds: summary.combinedOdds,
			probability: summary.probability,
			ev: summary.ev,
			legs: this.transferRows.map(({ tip, tippmixOdds }) => ({
				tipId: tip.id,
				fixtureId: tip.fixtureId,
				pairing: formatPairing(tip.home.name, tip.away.name),
				tippmixLabel: tip.tippmixLabel,
				kickoff: tip.kickoff.toISOString(),
				pModel: tip.pModel,
				minOdds: tip.minOdds,
				tippmixOdds: tippmixOdds as number,
				modelVersion: tip.modelVersion,
				outcome: tip.outcome
			}))
		};
		const bet = this.recordBet ? slipToPlacedBet(slip) : null;
		if (!bet) slip.sync = 'local';
		this.saved = [...this.saved, slip];
		this.storage.save(this.saved);
		this.tips = [];
		this.inputs.clear();
		this.transferOpen = false;
		this.lastSavedId = slip.id;
		if (bet && this.recordBet) this.pending = this.syncSlip(slip.id, bet, this.recordBet);
		return slip;
	}

	/** Az utolsó szerver-rögzítés ígérete (tesztekhez). */
	pending: Promise<void> = Promise.resolve();

	/**
	 * Szingli szelvény → `placed_bet` (DECISIONS I23b); a helyi mentés offline-tartalék marad, hiba esetén `failed` jelzéssel.
	 * TODO(polish): `failed`/I23b előtti szingli szelvények újrapróbálása.
	 */
	private syncSlip(id: string, bet: PlacedBetDraft, recordBet: RecordBet): Promise<void> {
		const mark = (patch: Partial<ISavedSlip>) =>
			runInAction(() => {
				this.saved = this.saved.map((s) => (s.id === id ? { ...s, ...patch } : s));
				this.storage.save(this.saved);
			});
		return recordBet(bet).then(
			(dto) => mark({ sync: 'server', serverBetId: dto.id }),
			() => mark({ sync: 'failed' })
		);
	}

	/** Az utoljára mentett szelvény (visszajelzéshez). */
	@computed get lastSaved(): ISavedSlip | undefined {
		return this.saved.find((s) => s.id === this.lastSavedId);
	}
}
