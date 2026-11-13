// „kb. minden N-edik ilyen szelvény nyer” (DESIGN.md v0.2 §8.1): N = round(1 / esély), magyar sorszámnévvel.

const UNIT = ['', 'első', 'második', 'harmadik', 'negyedik', 'ötödik', 'hatodik', 'hetedik', 'nyolcadik', 'kilencedik'];
/** Összetett alakban az 1 és 2 más: tizenegyedik, huszonkettedik. */
const UNIT_COMPOUND = ['', 'egyedik', 'kettedik', ...UNIT.slice(3)];
const TENS_ALONE = [
	'',
	'tizedik',
	'huszadik',
	'harmincadik',
	'negyvenedik',
	'ötvenedik',
	'hatvanadik',
	'hetvenedik',
	'nyolcvanadik',
	'kilencvenedik'
];
const TENS_PREFIX = ['', 'tizen', 'huszon', 'harminc', 'negyven', 'ötven', 'hatvan', 'hetven', 'nyolcvan', 'kilencven'];

/** Magyar sorszámnév 1–100 között (`9` → „kilencedik”, `22` → „huszonkettedik”); fölötte „123.”. */
export const hungarianOrdinal = (n: number): string => {
	if (!Number.isInteger(n) || n < 1) return `${n}.`;
	if (n === 100) return 'századik';
	if (n > 100) return `${n}.`;
	const tens = Math.floor(n / 10);
	const unit = n % 10;
	if (tens === 0) return UNIT[unit];
	return unit === 0 ? TENS_ALONE[tens] : TENS_PREFIX[tens] + UNIT_COMPOUND[unit];
};

/** N = round(1 / esély); 0 vagy negatív esélynél `Infinity`. */
export const oneInN = (probability: number): number => (probability > 0 ? Math.round(1 / probability) : Infinity);

/**
 * Egymondatos gyakoriság (tagmondat, pont nélkül): „kb. minden kilencedik ilyen szelvény nyer”.
 * N ≤ 1 (esély ≥ 67%) → „a legtöbb ilyen szelvény nyer”; nulla esély → „ilyen szelvény szinte sosem nyer”.
 */
export const oneInText = (probability: number): string => {
	const n = oneInN(probability);
	if (!Number.isFinite(n)) return 'ilyen szelvény szinte sosem nyer';
	if (n <= 1) return 'a legtöbb ilyen szelvény nyer';
	return `kb. minden ${hungarianOrdinal(n)} ilyen szelvény nyer`;
};
