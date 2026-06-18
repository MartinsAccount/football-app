import React, { useEffect, useRef } from 'react';

interface IModalShellProps {
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';

// Hozzáférhető modál-burok: backdrop (kattintásra zár), Esc-re zár, fókusz a
// panelen + Tab focus-trap, záráskor a fókusz visszaáll. role="dialog"/aria-modal.
const ModalShell: React.FC<IModalShellProps> = ({ onClose, children, className = '' }) => {
	const panelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const previouslyFocused = document.activeElement as HTMLElement | null;
		panelRef.current?.focus();

		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				onClose();
				return;
			}
			if (e.key === 'Tab' && panelRef.current) {
				const nodes = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
				if (nodes.length === 0) {
					e.preventDefault();
					return;
				}
				const first = nodes[0];
				const last = nodes[nodes.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};

		document.addEventListener('keydown', onKeyDown);
		return () => {
			document.removeEventListener('keydown', onKeyDown);
			previouslyFocused?.focus?.();
		};
	}, [onClose]);

	return (
		<div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				tabIndex={-1}
				onClick={(e) => e.stopPropagation()}
				className={`relative max-h-[85vh] overflow-auto bg-surface border border-border-subtle rounded-xl p-6 outline-none ${className}`}
			>
				<button
					type="button"
					aria-label="Bezárás"
					onClick={onClose}
					className="appearance-none border-0 bg-transparent cursor-pointer absolute top-3 right-3 h-8 w-8 rounded-md text-text-muted hover:text-text hover:bg-surface-2 text-xl leading-none"
				>
					×
				</button>
				{children}
			</div>
		</div>
	);
};

export default ModalShell;
