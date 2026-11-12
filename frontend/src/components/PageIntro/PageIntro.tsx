import React, { Component, CSSProperties, ReactNode } from 'react';
import { formatDayHeading } from '@football/core';
import { v } from '../../design/tokens/tokens';

interface IPageIntroProps {
	title: string;
	/** A h1 második, halvány sora. */
	subtitle?: string;
	/** Dátum a cím fölött; alapból a mai nap. `null` → nincs dátum. */
	date?: Date | null;
	/** Jobb oldali opcionális elem (pl. ModeSwitch). */
	aside?: ReactNode;
}

const sectionStyle: CSSProperties = { gap: v('space.10'), paddingBlock: v('space.14') };
const textStyle: CSSProperties = { flex: `1 1 ${v('size.main-basis')}` };

/** DESIGN §7.2: dátum → kétsoros h1, jobbra opcionális ModeSwitch. */
class PageIntro extends Component<IPageIntroProps> {
	render() {
		const { title, subtitle, date, aside } = this.props;
		const shownDate = date === undefined ? new Date() : date;

		return (
			<section className="flex flex-wrap items-end justify-between" style={sectionStyle}>
				<div className="min-w-0" style={textStyle}>
					{shownDate && <div className="oe-muted text-small">{formatDayHeading(shownDate)}</div>}
					<h1 className="oe-h1">
						{title}
						{subtitle && (
							<>
								<br />
								<span className="oe-muted">{subtitle}</span>
							</>
						)}
					</h1>
				</div>
				{aside}
			</section>
		);
	}
}

export default PageIntro;
