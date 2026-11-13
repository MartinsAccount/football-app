import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { NavLink } from 'react-router-dom';
import { MainStore } from '../../stores/MainStore';
import { isFixtureMode } from '../../services/dataMode';
import { cx, statusDot } from '../ui/oeClasses';
import ThemeToggle from './ThemeToggle';

interface IAppHeaderProps {
	MainStore?: MainStore;
}

// DESIGN §7.1 – a szelvény a Ma oldalon él (SlipPanel), az Odds nézet a meccs-részletekbe olvad (ROADMAP H).
const NAV_ITEMS: { to: string; label: string; exact?: boolean }[] = [
	{ to: '/', label: 'Ma', exact: true },
	{ to: '/evaluation', label: 'Kiértékelés' },
	{ to: '/arbitrage', label: 'Arbitrázs' },
	{ to: '/settings', label: 'Beállítások' }
];

/** Napi API-keret (free tier). TODO(polish): a budget a backend-proxyból jöjjön (S10). */
const DAILY_CALL_LIMIT = 100;

@inject('MainStore')
@observer
class AppHeader extends Component<IAppHeaderProps> {
	render() {
		const { MainStore } = this.props;
		const fixture = isFixtureMode();

		return (
			<header className="oe-header">
				<div className="oe-brand">
					<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
						<circle cx="15" cy="15" r="13" fill="none" stroke="var(--color-accent-default)" strokeWidth="2" />
						<path d="M15 2 V28 M2 15 H28" stroke="var(--color-accent-default)" strokeWidth="1.2" opacity=".5" />
						<circle cx="15" cy="15" r="4" fill="var(--color-accent-default)" />
					</svg>
					Odds elemző
				</div>
				<nav className="oe-nav" aria-label="Fő navigáció">
					{NAV_ITEMS.map(({ to, label, exact }) => (
						// RRv5 NavLink az aktív linkre aria-current="page"-et tesz → .oe-nav__link[aria-current] stílus
						<NavLink key={to} to={to} exact={exact} className="oe-nav__link">
							{label}
						</NavLink>
					))}
				</nav>
				{/* TODO(polish): S26 – .oe-status-pill a referencia szerint. */}
				<div className="oe-header__end">
					<span className={cx(statusDot, fixture && 'before:bg-warning')}>
						{fixture ? 'Mentett adat' : 'Élő adat'} · {MainStore.fetchNumber}/{DAILY_CALL_LIMIT} hívás
					</span>
					<ThemeToggle store={MainStore.ThemeStore} />
				</div>
			</header>
		);
	}
}

export default AppHeader;
