import React, { CSSProperties, PureComponent } from 'react';
import { v } from '../../design/tokens/tokens';
import { IArbRow } from './arbitrageView';
import { card, cardSelected, cx } from '../../components/ui/oeClasses';

const tableStyle: CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: v('font.size.small') };
const cell: CSSProperties = {
	padding: `${v('space.3')} ${v('space.4')}`,
	borderBottom: `1px solid ${v('color.border.default')}`,
	textAlign: 'right',
	whiteSpace: 'nowrap',
	fontVariantNumeric: 'tabular-nums'
};
const cellFirst: CSSProperties = { ...cell, textAlign: 'left', paddingLeft: 0, whiteSpace: 'normal' };
const headCell: CSSProperties = { ...cell, color: v('color.text.muted'), fontWeight: v('font.weight.semibold') };
const headFirst: CSSProperties = { ...headCell, textAlign: 'left', paddingLeft: 0 };
const statsStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	gap: `${v('space.2')} ${v('space.8')}`,
	alignItems: 'baseline'
};

interface IArbitrageCardProps {
	row: IArbRow;
	totalStake: string;
}

/**
 * Egy meccs egy piaca (DESIGN §7 kártya): Σ 1/odds, hozam és a lábak a tét-elosztással. A régi modál helyett minden
 * adat a kártyán látszik (ui-audit #7: nincs backdrop nélküli modál).
 */
class ArbitrageCard extends PureComponent<IArbitrageCardProps> {
	render() {
		const { row, totalStake } = this.props;
		const tone = row.positive
			? v('color.accent.text')
			: row.band === 'near'
			? v('color.signal.warning-text')
			: v('color.text.muted');
		const titleId = `arb-${row.key}`;
		return (
			<article
				className={cx(card, cardSelected)}
				aria-labelledby={titleId}
				data-selected={row.band === 'arb' ? 'true' : undefined}
			>
				<div className="oe-tip__meta flex flex-wrap justify-between gap-sp-4">
					<span>{row.league}</span>
					<span>{row.kickoff}</span>
				</div>
				<div>
					<h3 className="oe-tip__title" id={titleId}>
						{row.pairing}
					</h3>
					<div className="oe-tip__market">
						{row.market} · {row.bookmakerCount} iroda
					</div>
				</div>
				<div style={statsStyle}>
					<span className={row.band === 'arb' ? 'oe-tag oe-tag--accent' : 'oe-tag'}>{row.bandLabel}</span>
					<span className="oe-num">
						Σ 1/odds <strong>{row.sum}</strong>
					</span>
					<span className="oe-num" style={{ color: tone, fontWeight: v('font.weight.bold') }}>
						{row.margin}
					</span>
				</div>
				<table style={tableStyle}>
					<caption className="sr-only">Tét-elosztás {totalStake} összes tétre</caption>
					<thead>
						<tr>
							<th style={headFirst} scope="col">
								Kimenet
							</th>
							<th style={headCell} scope="col">
								Iroda
							</th>
							<th style={headCell} scope="col">
								Odds
							</th>
							<th style={headCell} scope="col">
								Tét
							</th>
						</tr>
					</thead>
					<tbody>
						{row.legs.map((l) => (
							<tr key={l.outcome}>
								<th style={{ ...cellFirst, fontWeight: v('font.weight.regular') }} scope="row">
									{l.outcome}
								</th>
								<td style={cell}>{l.bookmaker}</td>
								<td style={{ ...cell, fontWeight: v('font.weight.bold') }}>{l.odds}</td>
								<td style={cell}>{l.stake}</td>
							</tr>
						))}
					</tbody>
				</table>
				<div className="oe-tip__meta flex flex-wrap justify-between gap-sp-4">
					<span>Kifizetés (legrosszabb kimenet): {row.payout}</span>
					<span
						style={{
							color: row.profitPositive ? v('color.accent.text') : v('color.signal.negative-text'),
							fontWeight: v('font.weight.bold')
						}}
					>
						{row.profit}
					</span>
				</div>
			</article>
		);
	}
}

export default ArbitrageCard;
