import React from 'react';

interface ICardProps {
	className?: string;
	children: React.ReactNode;
}

// Presentational surface card (lásd docs/fe/design-system.md).
const Card: React.FC<ICardProps> = ({ className = '', children }) => (
	<div className={`bg-surface border border-border-subtle rounded-xl ${className}`}>{children}</div>
);

export default Card;
