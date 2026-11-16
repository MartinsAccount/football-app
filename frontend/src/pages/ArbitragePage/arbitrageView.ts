// `/arbitrage` nézet-modell: M10 óta a core `arbitrage/view.ts`-ben él (a mobil Arbitrázs-képernyő is ezt használja).
// A web-oldali nevek változatlanok.
export {
	ARB_BAND_LABEL as BAND_LABEL,
	ARB_BAND_OPTIONS as BAND_OPTIONS,
	ARBITRAGE_SUBTITLE,
	arbitrageHeadChips,
	arbitrageRows,
	arbitrageTiles,
	DEFAULT_TOTAL_STAKE,
	defaultArbitrageFilter as defaultFilter,
	formatMarginPct,
	historicalNotice,
	MIN_TOTAL_STAKE,
	parseTotalStake,
	STAKE_ROUNDING
} from '@football/core';
export type { BandFilter, IArbFilter, IArbRow, IArbTile, ILegRow } from '@football/core';
