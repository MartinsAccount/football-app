import React from 'react';

interface IButtonProps {
	children: React.ReactNode;
	onClick?: () => void;
	variant?: 'primary' | 'secondary';
	active?: boolean;
	type?: 'button' | 'submit';
	className?: string;
}

// Megosztott gomb (kiváltja a régi MyButton-t). Preflight ki van, ezért a natív
// gomb-stílust helyben reseteljük.
const Button: React.FC<IButtonProps> = ({
	children,
	onClick,
	variant = 'secondary',
	active = false,
	type = 'button',
	className = ''
}) => {
	const base = 'appearance-none border cursor-pointer rounded-lg px-4 py-2.5 text-sm font-medium transition-colors';

	let look: string;
	if (active) {
		look = 'bg-accent/10 border-accent text-accent';
	} else if (variant === 'primary') {
		look = 'bg-accent border-accent text-bg hover:opacity-90';
	} else {
		look = 'bg-surface border-border-subtle text-text-muted hover:bg-surface-2 hover:text-text';
	}

	return (
		<button type={type} onClick={onClick} className={`${base} ${look} ${className}`}>
			{children}
		</button>
	);
};

export default Button;
