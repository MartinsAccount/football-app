import React, { ReactNode } from 'react';

interface IPageHeadProps {
	title: string;
	/** Meta-chipek a cím alatt (`.oe-meta-chip`); csak meglévő adatból. */
	chips?: string[];
	/** Jobb oldali opcionális slot (szűrők, `.oe-filters`). */
	filters?: ReactNode;
}

/** DESIGN §2/§6 „Közös”: kompakt oldalfej – 32 px cím + meta-chipek, jobbra a szűrők. A nagy cím csak a Ma oldalon marad. */
const PageHead = ({ title, chips = [], filters }: IPageHeadProps) => (
	<section className="oe-page-head">
		<div className="min-w-0">
			<h1 className="oe-page-title">{title}</h1>
			{chips.length > 0 && (
				<div className="oe-chips">
					{chips.map((c) => (
						<span key={c} className="oe-meta-chip">
							{c}
						</span>
					))}
				</div>
			)}
		</div>
		{filters && <div className="oe-filters">{filters}</div>}
	</section>
);

export default PageHead;
