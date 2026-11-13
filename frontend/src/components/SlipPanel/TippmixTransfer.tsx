import React, { CSSProperties } from 'react';
import { formatPairing } from '@football/core';
import { ITransferRow } from '../../stores/SlipStore';
import { v } from '../../design/tokens/tokens';
import { TRANSFER_STATUS_TEXT, transferFieldLabel } from './slipView';
import { cx, dangerBox, dangerText, input } from '../ui/oeClasses';

const rowStyle: CSSProperties = { gap: v('space.4'), paddingBlock: v('space.6'), borderTop: `1px solid ${v('color.bg.track')}` };
const fieldRowStyle: CSSProperties = { gap: v('space.6') };
const listStyle: CSSProperties = { gap: v('space.2') };

interface ITippmixTransferProps {
	rows: ITransferRow[];
	canSave: boolean;
	onInput: (tipId: string, value: string) => void;
	onSave: () => void;
	onClose: () => void;
	/** Egyedi id-előtag (asztali panel és mobil alsó lap egyszerre a DOM-ban). */
	idPrefix?: string;
}

/**
 * DESIGN §7.7 – Tippmixre vitel: lábanként a beírt Tippmix-odds és állapota; az összesítő ezekkel számol újra.
 * Mentés = a megtett szelvény rögzítése (PRD 7.3); automatikus fogadásleadás nincs (PRD 8).
 */
const TippmixTransfer = ({ rows, canSave, onInput, onSave, onClose, idPrefix = 'slip' }: ITippmixTransferProps) => {
	const titleId = `${idPrefix}-tippmix-transfer-title`;
	const below = rows.filter((r) => r.status === 'below');
	return (
		<section className="flex flex-col" style={listStyle} aria-labelledby={titleId}>
			<div className="flex justify-between items-baseline">
				<h3 className="oe-label" id={titleId}>
					Tippmixre viszem
				</h3>
				<button className="oe-btn" type="button" onClick={onClose}>
					Vissza
				</button>
			</div>
			<ol className="list-none m-0 p-0">
				{rows.map(({ tip, input, status }, i) => (
					<li key={tip.id} className="flex flex-col" style={rowStyle}>
						<div className="min-w-0">
							<strong className="block truncate text-small">
								{i + 1}. {formatPairing(tip.home.name, tip.away.name)}
							</strong>
							<div className="oe-muted truncate text-caption">{tip.tippmixLabel}</div>
						</div>
						<div className="flex items-end" style={fieldRowStyle}>
							<label className="oe-field flex-1 min-w-0">
								{transferFieldLabel(tip.minOdds)}
								<input
									className={input}
									inputMode="decimal"
									autoComplete="off"
									value={input}
									data-valid={status === 'valid' || undefined}
									aria-invalid={status === 'below' || undefined}
									onChange={(e) => onInput(tip.id, e.target.value)}
								/>
							</label>
							<span
								className={status === 'below' ? cx('oe-warning shrink-0', dangerText) : 'oe-muted text-caption shrink-0'}
								aria-live="polite"
							>
								{TRANSFER_STATUS_TEXT[status]}
							</span>
						</div>
					</li>
				))}
			</ol>
			{below.length > 0 && (
				<div className={cx('oe-warning', dangerBox)} role="alert">
					✗ {below.map((r) => formatPairing(r.tip.home.name, r.tip.away.name)).join(', ')}: a minimum alatt – hagyd ki, vagy
					cseréld egy másik tippre a listából.
					{/* TODO(polish): konkrét cserejavaslat (a lista következő, nem ütköző tippje). */}
				</div>
			)}
			<button className="oe-btn oe-btn--neutral oe-btn--cta" type="button" disabled={!canSave} onClick={onSave}>
				Megtettem – szelvény mentése
			</button>
			{!canSave && <div className="oe-muted text-caption">Mentéshez írd be minden tipp Tippmix-oddsát.</div>}
		</section>
	);
};

export default TippmixTransfer;
