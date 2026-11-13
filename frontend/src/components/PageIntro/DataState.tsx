import React, { Component } from 'react';

interface IDataStateProps {
	/** Fő pill (`.oe-pill--warning`), pl. „Mentett adat · 2025. ápr. 12–13.” */
	label: string;
	/** Mellékchipek, pl. „Odds 17 órás”. */
	chips: string[];
	/** „Mit jelent?” – a teljes magyarázat. */
	detail: string;
	/** Az egyedi `id` alapja (aria-controls). */
	id?: string;
}

interface IDataStateState {
	open: boolean;
}

/** DESIGN §2 „Az állapot kicsi, nem hangos”: chip-sor a cím alatt + „Mit jelent?” lenyitó (`aria-expanded`, `hidden`). */
class DataState extends Component<IDataStateProps, IDataStateState> {
	state: IDataStateState = { open: false };

	toggle = () => this.setState(({ open }) => ({ open: !open }));

	render() {
		const { label, chips, detail, id = 'datastate' } = this.props;
		const { open } = this.state;
		return (
			<>
				<div className="oe-chips">
					<span className="oe-pill oe-pill--warning">{label}</span>
					{chips.map((c) => (
						<span key={c} className="oe-pill">
							{c}
						</span>
					))}
					<button className="oe-linkbtn" type="button" aria-expanded={open} aria-controls={id} onClick={this.toggle}>
						Mit jelent?
					</button>
				</div>
				<div className="oe-datastate__detail" id={id} hidden={!open}>
					{detail}
				</div>
			</>
		);
	}
}

export default DataState;
