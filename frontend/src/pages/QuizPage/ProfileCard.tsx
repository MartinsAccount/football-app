import React, { CSSProperties } from 'react';
import type { ProfileResponse } from '@football/contract';
import { card } from '../../components/ui/oeClasses';
import { crossValidationTiles, profileProgress, profileStatus, sourcesText } from './quizView';

const vars = (o: Record<string, string>): CSSProperties => o as CSSProperties;

/**
 * Profilkártya (ROADMAP 12.3): állapot, haladás a 20 válaszig, top 3 tulajdonság, keresztvalidált egyezés a
 * „mindig a favorit” baseline mellett. TODO(polish): súlyok teljes listája lenyitóban; bizalom szerinti bontás.
 */
const ProfileCard = ({ data }: { data: ProfileResponse }) => {
	const { profile, crossValidation, sources } = data;
	const status = profileStatus(profile);
	const progress = profileProgress(profile);
	const cv = crossValidationTiles(crossValidation);
	return (
		<section className={card} aria-labelledby="h-profile">
			<div className="flex flex-wrap items-center justify-between gap-sp-4">
				<h2 className="oe-h2 m-0" id="h-profile">
					Saját profil
				</h2>
				<span className="oe-status-pill" data-state={status.state}>
					{status.label}
				</span>
			</div>
			<div>
				<div className="flex justify-between gap-sp-4 text-small text-text-secondary">
					<span>{progress.text}</span>
					{profile.skipped > 0 && <span className="oe-muted">{profile.skipped} kihagyva</span>}
				</div>
				<div className="oe-pbar" style={vars({ '--p': progress.width })} role="img" aria-label={progress.aria}>
					<div className="oe-pbar__fill" />
				</div>
			</div>
			{profile.traits.length > 0 ? (
				<div>
					<p className="oe-label">Ilyen tippelő vagy</p>
					<ul className="m-0 mt-sp-3 flex list-disc flex-col gap-sp-3 pl-sp-8 text-text-secondary">
						{profile.traits.map((t) => (
							<li key={t}>{t}</li>
						))}
					</ul>
				</div>
			) : (
				<p className="oe-muted m-0">A profil 20 tippes válasz után áll össze; addig a kihagyás is tanít.</p>
			)}
			{cv && (
				<div className="grid grid-cols-2 gap-sp-4">
					<div className="oe-tile">
						<div className="oe-tile__label">Egyezés veled</div>
						{/* Accent csak, ha a profil többször egyezik, mint a favorit-baseline (DESIGN §1.3). */}
						<div className={cv.better ? 'oe-tile__value oe-tile__value--accent' : 'oe-tile__value'}>{cv.agreement}</div>
					</div>
					<div className="oe-tile">
						<div className="oe-tile__label">Mindig a favorit</div>
						<div className="oe-tile__value">{cv.baseline}</div>
					</div>
					<div className="oe-tile__foot col-span-2">{cv.foot}</div>
				</div>
			)}
			<p className="oe-muted m-0 text-caption">Forrás: {sourcesText(sources)}</p>
		</section>
	);
};

export default ProfileCard;
