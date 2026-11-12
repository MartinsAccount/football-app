import React, { Component } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import EmptyState from '../../components/PageIntro/EmptyState';

/** `/evaluation` – ROI, Brier, kalibráció, CLV (PRD 5.8). TODO(polish): dashboard az S21-ben. */
class EvaluationPage extends Component {
	render() {
		return (
			<>
				<PageIntro date={null} title="Kiértékelés." subtitle="Mennyire jók a tippjeink?" />
				<EmptyState
					title="Még nincs kiértékelt tipp"
					text="A backtest lefutása után itt látod a találati arányt, a hozamot, a Brier-pontszámot, a kalibrációt és a CLV-t."
				/>
			</>
		);
	}
}

export default EvaluationPage;
