import { action, computed, observable } from 'mobx';
import {
	formatPairing,
	hasFixture,
	parseOddsInput,
	SlipLeg,
	SlipSummary,
	summarizeSlip,
	transferStatus,
	TransferStatus
} from '@football/core';
import { ITip } from '../components/TipCard/tipView';

/** Tét-lépcső Ft-ban (DESIGN §7.6). TODO(polish): a `/settings` egységéből (S22). */
export const STAKE_OPTIONS = [500, 1000, 2000, 5000] as const;
export const DEFAULT_STAKE = 1000;

/** Tippmixre vitel egy sora (DESIGN §7.7). */
export interface ITransferRow {
	tip: ITip;
	input: string;
	tippmixOdds: number | null;
	status: TransferStatus;
}

/** Mentett (megtett) szelvény: beírt Tippmix-odds + tét. Fogadásleadás nincs (PRD 8). */
export interface ISavedSlip {
	id: string;
	savedAt: string;
	stake: number;
	combinedOdds: number;
	probability: number;
	ev: number;
	legs: {
		tipId: string;
		fixtureId: number;
		pairing: string;
		tippmixLabel: string;
		kickoff: string;
		pModel: number;
		minOdds: number;
		tippmixOdds: number;
		modelVersion: string;
	}[];
}

/** A mentett szelvények tárolója; a DB-s írás (bet tábla) a backend-íróval jön. */
export interface ISlipStorage {
	load(): ISavedSlip[];
	save(slips: ISavedSlip[]): void;
}

const STORAGE_KEY = 'oe_saved_slips';

export const localSlipStorage: ISlipStorage = {
	load: () => {
		try {
			const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(STORAGE_KEY);
			return raw ? (JSON.parse(raw) as ISavedSlip[]) : [];
		} catch {
			return [];
		}
	},
	save: (slips) => {
		if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slips));
	}
};

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
	@observable sheetOpen = false;
	@observable.shallow saved: ISavedSlip[];
	/** Az utoljára mentett szelvény azonosítója (visszajelzéshez). */
	@observable lastSavedId: string | null = null;

	constructor(private storage: ISlipStorage = localSlipStorage) {
		this.saved = storage.load();
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

	/** Mobil alsó lap (DESIGN §7.9). */
	@action openSheet() {
		this.sheetOpen = true;
	}

	@action closeSheet() {
		this.sheetOpen = false;
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
				modelVersion: tip.modelVersion
			}))
		};
		this.saved = [...this.saved, slip];
		this.storage.save(this.saved);
		this.tips = [];
		this.inputs.clear();
		this.transferOpen = false;
		this.lastSavedId = slip.id;
		return slip;
	}
}
