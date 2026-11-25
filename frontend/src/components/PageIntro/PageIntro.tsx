import React, { Component, ReactNode } from 'react';
import { formatDayHeading } from '@football/core';

interface IPageIntroProps {
	title: string;
	/** A h1 második, halvány sora. */
	subtitle?: string;
	/** Dátum a cím fölött; alapból a mai nap. `null` → nincs dátum. */
	date?: Date | null;
	/** A cím alatti sor (Ma: DataState). */
	children?: ReactNode;
}

/** DESIGN §6 `.oe-hero` (csak a Ma oldalon): dátum → kétsoros `.oe-h1` → adat-állapot sor. */
class PageIntro extends Component<IPageIntroProps> {
	render() {
		const { title, subtitle, date, children } = this.props;
		const shownDate = date === undefined ? new Date() : date;
		return (
			<section className="oe-hero">
				{shownDate && <div className="oe-hero__date">{formatDayHeading(shownDate)}</div>}
				<h1 className="oe-h1">
					{title}
					{subtitle && (
						<>
							<br />
							<span>{subtitle}</span>
						</>
					)}
				</h1>
				{children}
			</section>
		);
	}
}

export default PageIntro;
