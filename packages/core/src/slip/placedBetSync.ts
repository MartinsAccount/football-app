import { formatEv, formatFt, formatPercent, formatUnits, formatDecimal } from '../format/format';
import type { BetSummary } from '../evaluation/evaluation';
import type { OwnBetsSummary } from '../evaluation/ownBets';
import type { ISavedSlip, SlipSync } from './savedSlip';

/**
 * Mentett szelvény → szerveren rögzített fogadás (ROADMAP 5.6, I23b). DECISIONS: csak az EGYLÁBÚ (szingli) szelvény megy fel
 * egy `placed_bet` sorként; a kombinált szelvény csak helyben marad (`sync: 'local'`), mert a `placed_bet` nem modellezi a
 * több láb – egy tét kötést, és lábanként feltöltve a tét többszöröződne (torzítaná a saját ROI-t).
 */

/** A `POST /api/bets` törzse (a contract `PlacedBetInput`-jával szerkezetileg azonos). */
export interface PlacedBetDraft {
	fixtureId: number;
	marketId: number;
	selection: string;
	line: number | null;
	oddTaken: number;
	stake: number;
	placedAt: string;
	note: string;
}

/** Snapshot-kimenet → API-Football piac + vonal (a pillanatkép O/U-ja mindig 2,5; DESIGN §7.4 `TIPPMIX_LABEL`). */
const OUTCOME_MARKET: Readonly<Record<string, { marketId: number; line: number | null }>> = {
	Home: { marketId: 1, line: null },
	Draw: { marketId: 1, line: null },
	Away: { marketId: 1, line: null },
	Over: { marketId: 5, line: 2.5 },
	Under: { marketId: 5, line: 2.5 },
	Yes: { marketId: 8, line: null },
	No: { marketId: 8, line: null }
};

/** Feltölthető-e a szelvény; `null` = csak helyben marad (kombinált, vagy ismeretlen/nem elszámolható kimenet). */
export const slipToPlacedBet = (slip: ISavedSlip): PlacedBetDraft | null => {
	if (slip.legs.length !== 1) return null;
	const leg = slip.legs[0];
	const m = leg.outcome ? OUTCOME_MARKET[leg.outcome] : undefined;
	if (!m || !(leg.tippmixOdds > 1) || !(slip.stake > 0)) return null;
	return {
		fixtureId: leg.fixtureId,
		marketId: m.marketId,
		selection: leg.outcome as string,
		line: m.line,
		oddTaken: leg.tippmixOdds,
		stake: slip.stake,
		placedAt: slip.savedAt,
		note: `szelvény ${slip.id} · ${leg.modelVersion}`
	};
};

/** Szinkron-jelzés magyarul a mentett szelvényhez. */
export const slipSyncText = (sync: SlipSync | undefined): string =>
	sync === 'server'
		? 'rögzítve a szerveren'
		: sync === 'failed'
		? 'csak helyben – a szerverre rögzítés nem sikerült'
		: sync === 'local'
		? 'csak helyben – kombinált vagy nem elszámolható szelvény, a saját ROI-ba nem kerül'
		: 'csak helyben';

export interface IOwnBetsRow {
	key: string;
	label: string;
	bets: string;
	hitRate: string;
	roi: string;
	roiTone: 'positive' | 'negative' | undefined;
	profit: string;
}

const pct = (x: number | null): string => (x === null ? '–' : formatPercent(x));
const tone = (roi: number | null): IOwnBetsRow['roiTone'] =>
	roi === null || roi === 0 ? undefined : roi > 0 ? 'positive' : 'negative';
const flatRow = (key: string, label: string, b: BetSummary): IOwnBetsRow => ({
	key,
	label,
	bets: formatDecimal(b.n, 0),
	hitRate: pct(b.hitRate),
	roi: b.roi === null ? '–' : formatEv(b.roi),
	roiTone: tone(b.roi),
	profit: b.n ? formatUnits(b.profit) : '–'
});

/** Saját vs. modell ROI sorai (`GET /api/bets` `summary`). */
export const ownBetsRows = (s: OwnBetsSummary): IOwnBetsRow[] => [
	{
		key: 'own',
		label: 'Saját (tényleges tét)',
		bets: formatDecimal(s.own.n, 0),
		hitRate: pct(s.own.hitRate),
		roi: s.own.roi === null ? '–' : formatEv(s.own.roi),
		roiTone: tone(s.own.roi),
		profit: s.own.staked ? formatFt(s.own.profit) : '–'
	},
	flatRow('ownFlat', 'Saját (flat)', s.ownFlat),
	flatRow('modelSame', 'Modell ugyanezeken', s.modelSameBets),
	flatRow('model', 'Modell – minden ajánlás', s.model)
];

/** Fejléc-chip: rögzített és függő tippek. */
export const ownBetsChip = (s: OwnBetsSummary): string =>
	`${formatDecimal(s.own.n, 0)} rögzített tipp · ${formatDecimal(s.own.pending, 0)} függő`;
