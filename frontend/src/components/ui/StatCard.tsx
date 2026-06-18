import React from 'react';
import Card from './Card';

interface IStatCardProps {
	label: string;
	value: React.ReactNode;
	accent?: boolean;
}

// Címke + nagy érték statisztika-kártya. `accent` esetén az érték amber.
const StatCard: React.FC<IStatCardProps> = ({ label, value, accent = false }) => (
	<Card className="flex flex-col gap-2 p-5">
		<span className="text-sm text-text-muted">{label}</span>
		<span className={`text-3xl font-semibold ${accent ? 'text-accent' : 'text-text'}`}>{value}</span>
	</Card>
);

export default StatCard;
