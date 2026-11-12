import React, { CSSProperties } from 'react';
import { formatFt } from '@football/core';
import { v } from '../../design/tokens/tokens';

const labelStyle: CSSProperties = { marginBottom: v('space.4') };

interface IStakeSelectorProps {
	options: readonly number[];
	value: number;
	onChange: (stake: number) => void;
}

/** DESIGN §7.6/6 – tét-választó gombsor (`aria-pressed`). */
const StakeSelector = ({ options, value, onChange }: IStakeSelectorProps) => (
	<div>
		<div className="oe-muted text-small" style={labelStyle}>
			Tét
		</div>
		<div className="oe-stake" role="group" aria-label="Tét">
			{options.map((stake) => (
				<button key={stake} className="oe-btn" type="button" aria-pressed={stake === value} onClick={() => onChange(stake)}>
					{formatFt(stake)}
				</button>
			))}
		</div>
	</div>
);

export default StakeSelector;
