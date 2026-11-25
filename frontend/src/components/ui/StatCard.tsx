import React from 'react';
import Card from './Card';

interface IStatCardProps {
	label: string;
	value: React.ReactNode;
	accent?: boolean;
	sub?: React.ReactNode;
}

// Címke + nagy érték statisztika-kártya. `accent` esetén az érték amber.
// `sub`: opcionális halvány sor a nagy érték alatt (pl. százalék).
const StatCard: React.FC<IStatCardProps> = ({ label, value, accent = false, sub }) => (
	<Card className="flex flex-col gap-1 p-5">
		<span className="text-sm text-text-muted">{label}</span>
		<span className={`text-3xl font-semibold ${accent ? 'text-accent-text' : 'text-text'}`}>{value}</span>
		{sub !== undefined && sub !== null && <span className="text-sm text-text-muted">{sub}</span>}
	</Card>
);

export default StatCard;
