// Szelvény-vázlat platformfüggetlenül (ROADMAP 11.7, mobil M8): pillanatkép-tétel → láb, beírt oddsok → mentett szelvény.
// A web `SlipStore` ugyanezt a formátumot menti (`oe_saved_slips`); a mobil ezekkel a tiszta függvényekkel dolgozik.

import { formatPairing } from '../format/format';
import type { RecommendationItem, SnapshotOutcome } from '../recommend/snapshot';
import type { ISavedSlip } from './savedSlip';
import { parseOddsInput, SlipLeg, summarizeSlip, transferStatus, TransferStatus } from './slip';

/** Piac + kimenet Tippmix-nyelven (DESIGN §7.4). */
export const TIPPMIX_LABEL: Record<SnapshotOutcome, string> = {
	Home: 'Végeredmény · 1',
	Draw: 'Végeredmény · X',
	Away: 'Végeredmény · 2',
	Over15: 'Gólok száma 1,5 · Felett',
	Under15: 'Gólok száma 1,5 · Alatt',
	Over: 'Gólok száma 2,5 · Felett',
	Under: 'Gólok száma 2,5 · Alatt',
	Over35: 'Gólok száma 3,5 · Felett',
	Under35: 'Gólok száma 3,5 · Alatt',
	Yes: 'Mindkét csapat szerez gólt · Igen',
	No: 'Mindkét csapat szerez gólt · Nem',
	'Home/Draw': 'Kétesélyes · 1X',
	'Home/Away': 'Kétesélyes · 12',
	'Draw/Away': 'Kétesélyes · X2'
};

/** A szelvényhez szükséges tipp-adatok (dátum ISO szövegként). */
export interface SlipDraftTip {
	id: string;
	fixtureId: number;
	kickoff: string;
	homeName: string;
	awayName: string;
	tippmixLabel: string;
	pModel: number;
	bestOdds: number;
	minOdds: number;
	ev: number;
	modelVersion: string;
	/** Snapshot-kimenet (a szerverre rögzítéshez, I23b). */
	outcome?: string;
}

/** Pillanatkép-tétel → szelvény-tipp (az id a meccs-id, mint a weben: egy meccs = egy tipp). */
export const draftTipFromItem = (item: RecommendationItem): SlipDraftTip => ({
	id: String(item.fixtureId),
	fixtureId: item.fixtureId,
	kickoff: item.kickoff,
	homeName: item.home.name,
	awayName: item.away.name,
	tippmixLabel: TIPPMIX_LABEL[item.outcome],
	pModel: item.pModel,
	bestOdds: item.bestOdds,
	minOdds: item.minOdds,
	ev: item.ev,
	modelVersion: item.modelVersion,
	outcome: item.outcome
});

/** Beírt odds-szövegek tipp-id szerint. */
export type OddsInputs = Readonly<Record<string, string | undefined>>;

export interface DraftRow {
	tip: SlipDraftTip;
	input: string;
	tippmixOdds: number | null;
	status: TransferStatus;
}

/** Lábanként a beírt odds értelmezése és a Tippmixre-vitel státusza. */
export const draftRows = (tips: readonly SlipDraftTip[], inputs: OddsInputs): DraftRow[] =>
	tips.map((tip) => {
		const input = inputs[tip.id] ?? '';
		const tippmixOdds = parseOddsInput(input);
		return { tip, input, tippmixOdds, status: transferStatus(tippmixOdds, tip.minOdds) };
	});

/** Számításhoz használt lábak: beírt Tippmix-odds, ha érvényes, különben a legjobb odds (becslés). */
export const draftLegs = (tips: readonly SlipDraftTip[], inputs: OddsInputs): SlipLeg[] =>
	draftRows(tips, inputs).map(({ tip, tippmixOdds }) => ({
		fixtureId: tip.fixtureId,
		pModel: tip.pModel,
		bestOdds: tip.bestOdds,
		tippmixOdds: tippmixOdds ?? undefined
	}));

/** Menthető, ha van láb és mindegyikhez érvényes beírt odds tartozik (a min. alatti láb a felhasználó döntése). */
export const canSaveDraft = (tips: readonly SlipDraftTip[], inputs: OddsInputs): boolean =>
	tips.length > 0 && draftRows(tips, inputs).every((r) => r.status !== 'missing');

/** „Megtettem – szelvény mentése”: a beírt oddsokkal és téttel; nem menthető vázlatra null. */
export const buildSavedSlip = (
	tips: readonly SlipDraftTip[],
	inputs: OddsInputs,
	stake: number,
	now: Date = new Date()
): ISavedSlip | null => {
	if (!canSaveDraft(tips, inputs)) return null;
	const summary = summarizeSlip(draftLegs(tips, inputs), stake);
	if (!summary) return null;
	return {
		id: `slip-${now.getTime()}`,
		savedAt: now.toISOString(),
		stake,
		combinedOdds: summary.combinedOdds,
		probability: summary.probability,
		ev: summary.ev,
		legs: draftRows(tips, inputs).map(({ tip, tippmixOdds }) => ({
			tipId: tip.id,
			fixtureId: tip.fixtureId,
			pairing: formatPairing(tip.homeName, tip.awayName),
			tippmixLabel: tip.tippmixLabel,
			kickoff: tip.kickoff,
			pModel: tip.pModel,
			minOdds: tip.minOdds,
			tippmixOdds: tippmixOdds as number,
			modelVersion: tip.modelVersion,
			...(tip.outcome ? { outcome: tip.outcome } : {})
		}))
	};
};
