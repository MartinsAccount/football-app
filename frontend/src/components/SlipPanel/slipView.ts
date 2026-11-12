import { formatFt, formatOdds, RiskLevel, SlipSummary, slipTypeName, TransferStatus } from '@football/core';

const RISK_LABEL: Record<RiskLevel, string> = { low: 'Alacsony', medium: 'Közepes', high: 'Magas' };
const ORDINAL = ['', '', 'második', 'harmadik', 'negyedik', 'ötödik', 'hatodik', 'hetedik', 'nyolcadik', 'kilencedik', 'tizedik'];

/** Szelvény-fej: „Dupla kötés · 2 tipp”. */
export const slipHeadText = (legCount: number): string => `${slipTypeName(legCount)} · ${legCount} tipp`;

/** Egymondatos kockázat-magyarázat (DESIGN §7.6): „Alacsony kockázat: kb. minden harmadik ilyen szelvény nyer.” */
export const riskText = (probability: number, level: RiskLevel): string => {
	const n = Math.round(1 / Math.max(probability, 1e-6));
	const freq = n <= 1 ? 'a legtöbb ilyen szelvény nyer' : `kb. minden ${ORDINAL[n] ?? `${n}.`} ilyen szelvény nyer`;
	return `${RISK_LABEL[level]} kockázat: ${freq}.`;
};

/** Szingli-összevetés (DESIGN §7.6); egy lábnál nincs mit összevetni. */
export const singlesNote = (summary: SlipSummary, stake: number): string | null => {
	if (summary.legCount < 2) return null;
	const profit = summary.singlesExpectedProfit;
	const verdict = profit >= 0 ? `várható haszon ${formatFt(profit)}` : `várható veszteség ${formatFt(-profit)}`;
	return `Ugyanezek szingliben: ${summary.legCount} × ${formatFt(
		stake
	)} tét, ${verdict}. A kötés nagyobbat fizet, de ritkábban jön be.`;
};

/** Tippmixre vitel láb-állapota (DESIGN §7.7). */
export const TRANSFER_STATUS_TEXT: Record<TransferStatus, string> = {
	valid: '✓ megéri',
	below: '✗ min. alatt',
	missing: 'odds kell'
};

export const transferFieldLabel = (minOdds: number): string => `Tippmix odds (min. ${formatOdds(minOdds)})`;
