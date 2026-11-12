import React from 'react';
import { SlipSummary } from '@football/core';
import { slipBarText } from './slipView';

interface ISlipBarProps {
	summary: SlipSummary;
	onOpen: () => void;
}

/** DESIGN §6/§7.9 – mobilon alul lebegő szelvény-sáv („Szelvény · 2 tipp, dupla kötés / odds 3,10 · esély 39%”). */
const SlipBar = ({ summary, onOpen }: ISlipBarProps) => {
	const { title, detail } = slipBarText(summary);
	return (
		<div className="oe-slipbar" role="region" aria-label="Szelvény összesítő">
			<div className="oe-slipbar__text">
				<strong>{title}</strong>
				<span>{detail}</span>
			</div>
			<button className="oe-btn" type="button" onClick={onOpen} aria-haspopup="dialog">
				Megnyitás
			</button>
		</div>
	);
};

export default SlipBar;
