import React from 'react';

interface ISaveBarProps {
	/** `settingsDiff` szövege („Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB”). */
	diff: string;
	onDiscard: () => void;
	onSave: () => void;
}

/** CHANGES 5.: alul ragadó mentés-sáv, csak ha a piszkozat eltér a mentettől. A Mentés a fő CTA (accent). */
const SaveBar = ({ diff, onDiscard, onSave }: ISaveBarProps) => (
	<div
		role="region"
		aria-label="Nem mentett változások"
		className="sticky bottom-sp-8 z-20 mt-sp-12 flex flex-wrap items-center gap-sp-6 rounded-xl border border-border-strong bg-raised px-sp-8 py-sp-6 shadow-card"
	>
		<p className="m-0 min-w-0 flex-auto text-small font-bold tabular-nums" aria-live="polite">
			{diff}
		</p>
		<div className="flex flex-auto justify-end gap-sp-4 sm:flex-none">
			<button type="button" className="oe-btn flex-1 sm:flex-none" onClick={onDiscard}>
				Elvetés
			</button>
			<button type="button" className="oe-btn oe-btn--primary flex-1 sm:flex-none" onClick={onSave}>
				Mentés
			</button>
		</div>
	</div>
);

export default SaveBar;
