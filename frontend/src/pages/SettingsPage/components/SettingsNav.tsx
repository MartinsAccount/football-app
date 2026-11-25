import React from 'react';
import { cx } from '../../../components/ui/oeClasses';
import { SETTINGS_SECTIONS, SettingsSectionId } from '../settingsView';

interface ISettingsNavProps {
	active: SettingsSectionId;
	onSelect: (id: SettingsSectionId) => void;
}

/**
 * CHANGES 5.: szekció-menü. Asztalon (lg) bal oldali, ragadó oszlop; mobilon felül vízszintes chip-sor, amely a saját
 * dobozában görget (az oldal nem). Aktív = semleges kitöltés (`on.bg`, DESIGN §1.3), `aria-current`.
 */
const SettingsNav = ({ active, onSelect }: ISettingsNavProps) => (
	<nav
		aria-label="Beállítás-szekciók"
		className="sticky top-0 z-10 min-w-0 bg-canvas py-sp-4 lg:top-sp-8 lg:mx-0 lg:self-start lg:bg-transparent lg:py-0"
	>
		<ul className="m-0 flex list-none gap-sp-3 overflow-x-auto p-sp-2 lg:flex-col lg:overflow-visible lg:p-0">
			{SETTINGS_SECTIONS.map((s) => (
				<li key={s.id} className="shrink-0">
					<a
						href={`#${s.id}`}
						aria-current={active === s.id ? 'true' : undefined}
						onClick={(e) => {
							e.preventDefault();
							onSelect(s.id);
						}}
						className={cx(
							'flex min-h-touch items-center whitespace-nowrap rounded-pill border border-border-default px-sp-7 text-small font-bold text-text-secondary no-underline',
							'lg:rounded-l lg:border-transparent',
							'aria-[current=true]:border-on-bg aria-[current=true]:bg-on-bg aria-[current=true]:text-on-fg'
						)}
					>
						{s.label}
					</a>
				</li>
			))}
		</ul>
	</nav>
);

export default SettingsNav;
