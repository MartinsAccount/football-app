import React from 'react';
import { ownerPickChip, type ImitatedPick, type SnapshotOutcome } from '@football/core';

interface IOwnerPickChipProps {
	pick: Pick<ImitatedPick, 'pick' | 'probability' | 'factors'>;
	/** Az ajánlás kimenete (egyezés-jelzéshez). */
	outcome?: string;
}

/**
 * „Te ezt raknád” csip a tippkártyán (ROADMAP 12.5, Q5): a profil szerint utánzott tipp + valószínűség; az indok tooltipben
 * (`title`). Ha az ajánlás és az utánzott tipp egyezik, „egyezik a stílusoddal” címke.
 * TODO(polish): kattintásra/érintésre lenyíló indok (a `title` érintőképernyőn nem látszik).
 */
const OwnerPickChip = ({ pick, outcome }: IOwnerPickChipProps) => {
	const chip = ownerPickChip(pick, outcome as SnapshotOutcome | undefined);
	return (
		<div className="oe-chips">
			<span className="oe-pill" title={chip.detail}>
				{chip.label}
				<span className="sr-only">. {chip.detail}</span>
			</span>
			{chip.matches && <span className="oe-tag oe-tag--accent">egyezik a stílusoddal</span>}
		</div>
	);
};

export default OwnerPickChip;
