import React, { ReactNode } from 'react';

interface IPageHeadProps {
	title: string;
	/** Meta-chipek a cím alatt (`.oe-meta-chip`); csak meglévő adatból. */
	chips?: string[];
	/** Jobb oldali opcionális slot (szűrők, `.oe-filters`); ha nem fér el, a flex-wrap a cím alá tördeli. */
	filters?: ReactNode;
	/** Jól látható jelzés a chipek alatt (pl. `.oe-pill--warning`). */
	notice?: ReactNode;
}

/** DESIGN §2/§6 „Közös”: kompakt oldalfej – 32 px cím + meta-chipek, jobbra a szűrők. A nagy cím csak a Ma oldalon marad. */
const PageHead = ({ title, chips = [], filters, notice }: IPageHeadProps) => (
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
			{notice && <div className="oe-chips">{notice}</div>}
		</div>
		{filters && <div className="oe-filters">{filters}</div>}
	</section>
);

export default PageHead;
