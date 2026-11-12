import React, { Component } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import EmptyState from '../../components/PageIntro/EmptyState';

/** `/settings` – ligák, piacok, irodák, becsült napi hívás (PRD 5.8). TODO(polish): űrlap az S22-ben. */
class SettingsPage extends Component {
	render() {
		return (
			<>
				<PageIntro date={null} title="Beállítások." subtitle="Ligák, piacok, irodák és a napi keret." />
				<EmptyState
					title="Hamarosan"
					text="Itt választod ki a követett ligákat, piacokat és irodákat, és látod, hány API-hívást és mennyi tárhelyet igényelnek."
				/>
			</>
		);
	}
}

export default SettingsPage;
