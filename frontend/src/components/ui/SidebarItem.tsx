import React from 'react';

interface ISidebarItemProps {
	label: string;
	active: boolean;
	onClick: () => void;
}

// Megosztott oldalsáv-menüpont (Odds és Fixtures liga-választó). Preflight ki van,
// ezért a gomb natív stílusát helyben reseteljük (appearance-none / border-0).
const SidebarItem: React.FC<ISidebarItemProps> = ({ label, active, onClick }) => (
	<button
		type="button"
		onClick={onClick}
		className={`appearance-none border-0 cursor-pointer w-full flex items-center gap-3 text-left px-4 py-3 rounded-lg text-base transition-colors ${
			active ? 'bg-accent/10 text-accent font-medium' : 'bg-transparent text-text-muted hover:bg-surface-2 hover:text-text'
		}`}
	>
		<span className="h-4 w-4 rounded-[3px] border border-current opacity-70 shrink-0" />
		{label}
	</button>
);

export default SidebarItem;
