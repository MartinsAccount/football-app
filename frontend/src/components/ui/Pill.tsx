import React from 'react';

interface IPillProps {
	className?: string;
	children: React.ReactNode;
}

// Kis, lekerekített badge (pl. Szezon, Fetch szám).
const Pill: React.FC<IPillProps> = ({ className = '', children }) => (
	<span
		className={`inline-flex items-center gap-2 bg-surface border border-border-subtle rounded-full px-3 py-1 text-sm text-text-muted ${className}`}
	>
		{children}
	</span>
);

export default Pill;
