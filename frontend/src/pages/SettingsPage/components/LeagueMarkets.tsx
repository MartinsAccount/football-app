import React, { Component, CSSProperties } from 'react';
import { observer } from 'mobx-react';
import { leagueMarketOverride, SETTINGS_MARKETS } from '@football/core';
import { v } from '../../../design/tokens/tokens';
import type { SettingsStore } from '../../../stores/SettingsStore';

const listStyle: CSSProperties = {
	display: 'grid',
	gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, calc(${v('size.aside-basis')} * 1.2)), 1fr))`,
	gap: v('space.3'),
	margin: 0,
	padding: 0,
	listStyle: 'none'
};
const rowStyle: CSSProperties = {
	display: 'flex',
	flexWrap: 'wrap',
	alignItems: 'center',
	justifyContent: 'space-between',
	gap: `${v('space.3')} ${v('space.6')}`,
	minHeight: v('size.touch'),
	padding: `${v('space.3')} ${v('space.3')} ${v('space.3')} ${v('space.7')}`,
	background: v('color.bg.surface'),
	border: `1px solid ${v('color.border.default')}`,
	borderRadius: v('radius.l')
};
const nameStyle: CSSProperties = { display: 'flex', flexDirection: 'column', minWidth: 0, flex: '1 1 auto' };
const titleStyle: CSSProperties = {
	fontWeight: v('font.weight.bold'),
	overflow: 'hidden',
	textOverflow: 'ellipsis',
	whiteSpace: 'nowrap'
};
const metaStyle: CSSProperties = { fontSize: v('font.size.caption'), color: v('color.text.muted') };
const controlsStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: v('space.3'), maxWidth: '100%' };
const mutedStyle: CSSProperties = { margin: 0, fontSize: v('font.size.small'), color: v('color.text.muted') };

const label = (keys: readonly string[]) =>
	keys.length
		? SETTINGS_MARKETS.filter((m) => keys.includes(m.key))
				.map((m) => m.label)
				.join(' · ')
		: 'egy piac sem';

/**
 * Ligánkénti piac-felülírás (ROADMAP 2.3, I18f; `followed_league.markets`): követett ligánként Globális (a fenti piaclista) vagy
 * Egyéni piacok. Üres egyéni lista = a ligában egy piac sem (nincs ajánlás). Mentéskor a PUT `followedLeagues.upsert` viszi.
 * A tárolás a core `resolveStoredScope`-pal már ezzel számol, a becslés is. TODO(polish): mobil felület; ajánlás-oldali piac-szűrés.
 */
@observer
class LeagueMarkets extends Component<{ store: SettingsStore }> {
	render() {
		const { store } = this.props;
		const { draft, leagues } = store;
		const followed = leagues.filter((l) => draft.leagues.includes(l.id));
		if (!followed.length) return <p style={mutedStyle}>Előbb jelölj ki legalább egy követett ligát.</p>;

		return (
			<ul style={listStyle} aria-label="Ligánkénti piacok">
				{followed.map((l) => {
					const override = leagueMarketOverride(draft, l.id);
					return (
						<li key={l.id} style={rowStyle}>
							<span style={nameStyle}>
								<span style={titleStyle} title={l.name}>
									{l.name}
								</span>
								<span style={metaStyle}>{override ? `Egyéni: ${label(override)}` : `Globális: ${label(draft.markets)}`}</span>
							</span>
							<div style={controlsStyle}>
								<div className="oe-segmented" role="group" aria-label={`${l.name} piac-forrása`}>
									<button
										type="button"
										className="oe-segmented__btn"
										aria-pressed={override === null}
										onClick={() => store.setLeagueMarkets(l.id, null)}
									>
										Globális
									</button>
									<button
										type="button"
										className="oe-segmented__btn"
										aria-pressed={override !== null}
										onClick={() => override === null && store.setLeagueMarkets(l.id, draft.markets)}
									>
										Egyéni
									</button>
								</div>
								{override && (
									<div className="oe-segmented" role="group" aria-label={`${l.name} piacai`}>
										{SETTINGS_MARKETS.map((m) => (
											<button
												key={m.key}
												type="button"
												className="oe-segmented__btn"
												title={m.hint}
												aria-pressed={override.includes(m.key)}
												onClick={() => store.toggleLeagueMarket(l.id, m.key)}
											>
												{m.label}
											</button>
										))}
									</div>
								)}
							</div>
						</li>
					);
				})}
			</ul>
		);
	}
}

export default LeagueMarkets;
