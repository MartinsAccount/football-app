import React from 'react';

interface ISaveBarProps {
	/** `settingsDiff` szövege („Napi hívás: 17 → 21 · Tárhely/szezon: 17,5 → 20,1 MB”). */
	diff: string;
	/** PUT folyamatban (a Mentés tiltva). */
	saving?: boolean;
	/** A szerver elutasította a mentést (pl. 400: a liga nincs a DB-katalógusban); a piszkozat megmarad. */
	error?: string | null;
	onDiscard: () => void;
	onSave: () => void;
}

/** CHANGES 5.: alul ragadó mentés-sáv, csak ha a piszkozat eltér a mentettől. A Mentés a fő CTA (accent). */
const SaveBar = ({ diff, saving = false, error, onDiscard, onSave }: ISaveBarProps) => (
	<div
		role="region"
		aria-label="Nem mentett változások"
		className="sticky bottom-sp-8 z-20 mt-sp-12 flex flex-wrap items-center gap-sp-6 rounded-xl border border-border-strong bg-raised px-sp-8 py-sp-6 shadow-card"
	>
		<div className="min-w-0 flex-auto">
			<p className="m-0 text-small font-bold tabular-nums" aria-live="polite">
				{diff}
			</p>
			{error && (
				<p className="m-0 text-small text-negative-text" role="alert">
					Mentés sikertelen: {error}
				</p>
			)}
		</div>
		<div className="flex flex-auto justify-end gap-sp-4 sm:flex-none">
			<button type="button" className="oe-btn flex-1 sm:flex-none" onClick={onDiscard} disabled={saving}>
				Elvetés
			</button>
			<button type="button" className="oe-btn oe-btn--primary flex-1 sm:flex-none" onClick={onSave} disabled={saving}>
				{saving ? 'Mentés…' : 'Mentés'}
			</button>
		</div>
	</div>
);

export default SaveBar;
