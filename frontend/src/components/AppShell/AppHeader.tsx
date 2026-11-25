import { inject, observer } from 'mobx-react';
import React, { Component } from 'react';
import { NavLink } from 'react-router-dom';
import { MainStore } from '../../stores/MainStore';
import { AuthStore } from '../../stores/AuthStore';
import { isFixtureMode } from '../../services/dataMode';
import BudgetChip from './BudgetChip';
import ThemeToggle from './ThemeToggle';

interface IAppHeaderProps {
	MainStore?: MainStore;
	/** I31: a kilépés gomb csak akkor látszik, ha van web-login (tesztben hiányozhat). */
	AuthStore?: AuthStore;
}

// DESIGN §7.1 – a szelvény a Ma oldalon él (SlipPanel), az Odds nézet a meccs-részletekbe olvad (ROADMAP H).
const NAV_ITEMS: { to: string; label: string; exact?: boolean }[] = [
	{ to: '/', label: 'Ma', exact: true },
	{ to: '/evaluation', label: 'Kiértékelés' },
	{ to: '/quiz', label: 'Saját stílus' },
	{ to: '/arbitrage', label: 'Arbitrázs' },
	{ to: '/settings', label: 'Beállítások' }
];

// Mapper-forma: a hiányzó AuthStore (pl. tesztben) nem dob hibát, ellentétben az @inject('AuthStore')-szal.
@inject(({ MainStore, AuthStore }: IAppHeaderProps) => ({ MainStore, AuthStore }))
@observer
class AppHeader extends Component<IAppHeaderProps> {
	render() {
		const { MainStore, AuthStore } = this.props;
		const fixture = isFixtureMode();

		return (
			<header className="oe-header">
				<div className="oe-brand">
					<svg width="28" height="28" viewBox="0 0 30 30" aria-hidden="true">
						<circle cx="15" cy="15" r="13" fill="none" stroke="currentColor" strokeWidth="2" />
						<path d="M15 2 V28 M2 15 H28" stroke="currentColor" strokeWidth="1.2" opacity=".5" />
						<circle cx="15" cy="15" r="4" fill="currentColor" />
					</svg>
					<span className="text-text-primary">Odds elemző</span>
				</div>
				<nav className="oe-nav" aria-label="Fő navigáció">
					{NAV_ITEMS.map(({ to, label, exact }) => (
						// RRv5 NavLink az aktív linkre aria-current="page"-et tesz → .oe-nav__link[aria-current] stílus
						<NavLink key={to} to={to} exact={exact} className="oe-nav__link min-h-touch">
							{label}
						</NavLink>
					))}
				</nav>
				<div className="oe-header__end">
					{/* Budget-panel (I19): a pill a `/api/budget` napi keretét mutatja, kattintásra lenyílik. */}
					<BudgetChip fixture={fixture} localCalls={MainStore.fetchNumber} />
					<ThemeToggle store={MainStore.ThemeStore} />
					{AuthStore?.loginEnabled && (
						<button
							className="oe-btn oe-btn--icon"
							type="button"
							aria-label="Kilépés"
							title="Kilépés"
							onClick={() => AuthStore.logout()}
						>
							<svg
								width="18"
								height="18"
								viewBox="0 0 24 24"
								aria-hidden="true"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M9 20H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h3M16 17l5-5-5-5M21 12H9" />
							</svg>
						</button>
					)}
				</div>
			</header>
		);
	}
}

export default AppHeader;
