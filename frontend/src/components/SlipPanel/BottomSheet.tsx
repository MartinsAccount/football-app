import React, { Component, createRef, ReactNode } from 'react';

interface IBottomSheetProps {
	open: boolean;
	label: string;
	onClose: () => void;
	children: ReactNode;
}

/**
 * DESIGN §7.9 – mobil alsó lap (`.oe-sheet`) háttérrel. Bezárás: ✕, háttérre kattintás, Esc.
 * Nyitáskor a fókusz a lapra kerül, bezáráskor vissza oda, ahol előtte volt.
 */
class BottomSheet extends Component<IBottomSheetProps> {
	sheetRef = createRef<HTMLDivElement>();
	returnFocus: HTMLElement | null = null;

	componentDidMount() {
		if (this.props.open) this.onOpen();
	}

	componentDidUpdate(prev: IBottomSheetProps) {
		if (!prev.open && this.props.open) this.onOpen();
		if (prev.open && !this.props.open) this.onClosed();
	}

	componentWillUnmount() {
		document.removeEventListener('keydown', this.onKeyDown);
	}

	onOpen() {
		this.returnFocus = document.activeElement as HTMLElement | null;
		document.addEventListener('keydown', this.onKeyDown);
		this.sheetRef.current?.focus();
	}

	onClosed() {
		document.removeEventListener('keydown', this.onKeyDown);
		this.returnFocus?.focus?.();
		this.returnFocus = null;
	}

	onKeyDown = (e: KeyboardEvent) => {
		if (e.key === 'Escape') this.props.onClose();
	};

	render() {
		const { open, label, onClose, children } = this.props;
		if (!open) return null;
		return (
			<>
				<div className="oe-sheet-backdrop" onClick={onClose} aria-hidden="true" />
				<div className="oe-sheet" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={this.sheetRef}>
					<div className="oe-sheet__handle" aria-hidden="true" />
					<div className="oe-sheet__top">
						<button className="oe-btn oe-btn--icon" type="button" aria-label="Bezárás" onClick={onClose}>
							✕
						</button>
					</div>
					{children}
				</div>
			</>
		);
	}
}

export default BottomSheet;
