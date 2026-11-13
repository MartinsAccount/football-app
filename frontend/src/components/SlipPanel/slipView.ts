import {
	formatFt,
	formatOdds,
	formatPairing,
	formatPercent,
	oneInText,
	RiskLevel,
	SlipPreset,
	SlipSummary,
	slipTypeName,
	TransferStatus
} from '@football/core';
import { ITip } from '../TipCard/tipView';

const RISK_LABEL: Record<RiskLevel, string> = { low: 'Alacsony', medium: 'Közepes', high: 'Magas' };

/** Szelvény-fej: „Dupla kötés · 2 tipp”. */
export const slipHeadText = (legCount: number): string => `${slipTypeName(legCount)} · ${legCount} tipp`;

/** Egymondatos kockázat-magyarázat (DESIGN §8.1): „Alacsony kockázat: kb. minden harmadik ilyen szelvény nyer.” */
export const riskText = (probability: number, level: RiskLevel): string =>
	`${RISK_LABEL[level]} kockázat: ${oneInText(probability)}.`;

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

/** Mobil szelvény-sáv szövege (DESIGN §6): „Szelvény · 2 tipp, dupla kötés” / „odds 3,10 · esély 39%”. */
export const slipBarText = (summary: SlipSummary): { title: string; detail: string } => ({
	title: `Szelvény · ${summary.legCount} tipp, ${slipTypeName(summary.legCount).toLowerCase()}`,
	detail: `odds ${formatOdds(summary.combinedOdds)} · esély ${formatPercent(summary.probability)}`
});

/**
 * Kész szelvény neve (referencia `ma.html`): „Szingli · Bochum – Augsburg”, „Dupla kötés · mindkét tipp”,
 * „Dupla kötés · a 2 legjobb tipp”. `total` = a különböző meccsekről választható érték-tippek száma.
 */
export const presetTitle = (preset: SlipPreset, legs: readonly ITip[], total: number): string => {
	const n = preset.legIds.length;
	if (n === 1 && legs[0]) return `Szingli · ${formatPairing(legs[0].home.name, legs[0].away.name)}`;
	const scope = n === total ? (n === 2 ? 'mindkét tipp' : `mind a ${n} tipp`) : `a ${n} legjobb tipp`;
	return `${slipTypeName(n)} · ${scope}`;
};
