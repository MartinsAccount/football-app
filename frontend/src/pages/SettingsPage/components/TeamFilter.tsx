import React, { Component, CSSProperties } from 'react';
import { observer } from 'mobx-react';
import { teamFilterMode, TeamFilterMode } from '@football/core';
import { v } from '../../../design/tokens/tokens';
import type { SettingsStore } from '../../../stores/SettingsStore';

/** A csapatsor szegmensei: `null` = nincs szűrve (DESIGN §1.3: kiválasztás = semleges `aria-pressed`). */
const MODES: readonly { mode: TeamFilterMode | null; label: string }[] = [
	{ mode: null, label: 'Mind' },
	{ mode: 'include', label: 'Csak' },
	{ mode: 'exclude', label: 'Kizár' }
];

const listStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 0.94)), 1fr))`,
	gap: v('space.3'),
	margin: 0,
	padding: 0,
	listStyle: 'none'
};
const rowStyle: CSSProperties = {
	display: 'flex',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: v('space.6'),
	minHeight: v('size.touch'),
	padding: `${v('space.3')} ${v('space.3')} ${v('space.3')} ${v('space.7')}`,
	background: v('color.bg.surface'),
	border: `1px solid ${v('color.border.default')}`,
	borderRadius: v('radius.l')
};
const nameStyle: CSSProperties = {
	fontWeight: v('font.weight.bold'),
	minWidth: 0,
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap'
};
const mutedStyle: CSSProperties = { margin: 0, fontSize: v('font.size.small'), color: v('color.text.muted') };

/**
 * Csapatszűrő (ROADMAP 2.3, I18c): a követett ligák egyikének csapatai, csapatonként Mind / Csak / Kizár. A lista a
 * `/api/leagues/:id/teams`-ből jön; a választás a piszkozatba kerül (`teamFilters`), mentéskor a PUT `teamFilters` ága viszi.
 * TODO(polish): kereső és „összes törlése”; a más ligák szűrői csak a számlálóban látszanak.
 */
@observer
class TeamFilter extends Component<{ store: SettingsStore }> {
	componentDidMount() {
		this.ensureTeams();
	}

	componentDidUpdate() {
		this.ensureTeams();
	}

	/** A kiválasztott liga csapatlistáját render után kérjük (a render nem módosít állapotot). */
	ensureTeams() {
		const { teamsLeague, teamsState } = this.props.store;
		if (teamsLeague !== null && teamsState === null) this.props.store.loadTeams(teamsLeague);
	}

	render() {
		const { store } = this.props;
		const { draft, leagues, teamsLeague, teamsState } = store;
		if (teamsLeague === null) return <p style={mutedStyle}>Előbb jelölj ki legalább egy követett ligát.</p>;

		const followed = leagues.filter((l) => draft.leagues.includes(l.id));
		const count = (mode: TeamFilterMode) => draft.teamFilters.filter((f) => f.mode === mode).length;

		return (
			<>
				<div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: v('space.6') }}>
					<label className="oe-field" style={{ minWidth: 0, maxWidth: '100%' }}>
						<span>Liga</span>
						<select
							className="oe-select max-w-full"
							value={teamsLeague}
							onChange={(e) => store.selectTeamsLeague(Number(e.target.value))}
						>
							{followed.map((l) => (
								<option key={l.id} value={l.id}>
									{l.name}
								</option>
							))}
						</select>
					</label>
					<span className="oe-pill" role="status">
						{count('include')} csak · {count('exclude')} kizárt csapat
					</span>
				</div>

				{teamsState === null || teamsState === 'loading' ? (
					<p style={mutedStyle}>Csapatok betöltése…</p>
				) : teamsState === 'error' ? (
					<p style={mutedStyle}>
						A csapatlista nem érhető el (a szerver nem fut).{' '}
						<button type="button" className="oe-linkbtn" onClick={() => store.loadTeams(teamsLeague)}>
							Újra
						</button>
					</p>
				) : teamsState.teams.length === 0 ? (
					<p style={mutedStyle}>Ehhez a ligához még nincs tárolt csapat.</p>
				) : (
					<ul style={listStyle} aria-label="Csapatok">
						{teamsState.teams.map((t) => {
							const mode = teamFilterMode(draft.teamFilters, t.id);
							return (
								<li key={t.id} style={rowStyle}>
									<span style={nameStyle} title={t.name}>
										{t.name}
									</span>
									<div className="oe-segmented" role="group" aria-label={`${t.name} szűrése`} style={{ flex: 'none' }}>
										{MODES.map((m) => (
											<button
												key={m.label}
												type="button"
												className="oe-segmented__btn"
												aria-pressed={mode === m.mode}
												onClick={() => store.setTeamFilter(t.id, m.mode)}
											>
												{m.label}
											</button>
										))}
									</div>
								</li>
							);
						})}
					</ul>
				)}
				<p style={mutedStyle}>
					„Csak”: a liga többi csapatának meccsei kimaradnak. „Kizár”: a csapat meccsei kimaradnak. Mentés után érvényes.
				</p>
			</>
		);
	}
}

export default TeamFilter;
