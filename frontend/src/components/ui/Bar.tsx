import React from 'react';

interface IBarProps {
	percent: number;
}

// Amber kitöltésű mini progress sáv + a százalék szöveg (mockup: "Találati arány").
const Bar: React.FC<IBarProps> = ({ percent }) => {
	const clamped = Math.max(0, Math.min(100, Math.round(percent || 0)));

	return (
		<div className="flex items-center gap-3">
			<div className="h-1.5 w-24 rounded-full bg-surface-2 overflow-hidden">
				<div className="h-full rounded-full bg-accent" style={{ width: `${clamped}%` }} />
			</div>
			<span className="text-text-muted tabular-nums">{clamped}%</span>
		</div>
	);
};

export default Bar;
