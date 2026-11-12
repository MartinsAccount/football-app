import React, { Component } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import EmptyState from '../../components/PageIntro/EmptyState';

/** `/` – Ma: ajánlások TipCard-okkal + szelvény (PRD 5.8). TODO(polish): tartalom az S16–S20 szeletekben. */
class RecommendationsPage extends Component {
	render() {
		return (
			<>
				<PageIntro title="Rakd össze a mai szelvényt." subtitle="Az ajánlások hamarosan itt lesznek." />
				<EmptyState
					title="Még nincs mai ajánlás"
					text="A motor a mentett meccs- és odds-adatból számol. Amíg a modell nem fut, itt nincs tipp; az arbitrázs addig is elérhető."
				/>
			</>
		);
	}
}

export default RecommendationsPage;
