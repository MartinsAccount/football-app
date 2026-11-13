import React from 'react';
import { SlipSummary } from '@football/core';
import { slipBarText } from './slipView';
import { slipBar, slipBarBody } from '../ui/oeClasses';

interface ISlipBarProps {
	summary: SlipSummary;
	/** A szelvény-panel horgonya (a lista alatt). */
	href: string;
}

/** Mobilon (< 640 px) alul lebegő szelvény-sáv („Szelvény · 2 tipp, dupla kötés / odds 3,10 · esély 39%”) → a panelre ugrik. */
const SlipBar = ({ summary, href }: ISlipBarProps) => {
	const { title, detail } = slipBarText(summary);
	return (
		<div className={slipBar} role="region" aria-label="Szelvény összesítő">
			<div className={slipBarBody}>
				<strong>{title}</strong>
				<span>{detail}</span>
			</div>
			<a className="oe-btn oe-btn--neutral flex-none" href={href}>
				Megnézem
			</a>
		</div>
	);
};

export default SlipBar;
