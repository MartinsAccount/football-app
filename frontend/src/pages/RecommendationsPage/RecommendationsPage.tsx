import React, { Component, CSSProperties } from 'react';
import PageIntro from '../../components/PageIntro/PageIntro';
import EngineBanner from '../../components/EngineBanner/EngineBanner';
import MatchDetails from '../../components/MatchDetails/MatchDetails';
import TipCard from '../../components/TipCard/TipCard';
import { sampleTips } from '../../components/TipCard/sampleTips';
import { ITip } from '../../components/TipCard/tipView';
import { v } from '../../design/tokens/tokens';

const stackStyle: CSSProperties = { gap: v('space.9'), paddingBottom: v('space.14') };

interface IRecommendationsPageState {
	selectedIds: string[];
	expandedId: string | null;
}

/**
 * `/` – Ma: ajánlások TipCard-okkal + szelvény (PRD 5.8).
 * TODO(polish): S18 – valódi predikciók RecommendationStore-ból a minta helyett; S19 – a kijelölés a SlipStore-ba kerül.
 */
class RecommendationsPage extends Component<{}, IRecommendationsPageState> {
	tips: ITip[] = sampleTips();
	// Bemutatáshoz az első kártya nyitva indul (DESIGN-referencia).
	state: IRecommendationsPageState = { selectedIds: [], expandedId: this.tips[0]?.id ?? null };

	toggleSlip = (tip: ITip) =>
		this.setState(({ selectedIds }) => ({
			selectedIds: selectedIds.includes(tip.id) ? selectedIds.filter((id) => id !== tip.id) : [...selectedIds, tip.id]
		}));

	// Egyszerre egy kártya lehet nyitva (DESIGN §7.4).
	toggleExpand = (tip: ITip) => this.setState(({ expandedId }) => ({ expandedId: expandedId === tip.id ? null : tip.id }));

	render() {
		const { selectedIds, expandedId } = this.state;
		return (
			<>
				<PageIntro title="Rakd össze a mai szelvényt." subtitle="Minta-kártyák, amíg a motor nem fut." />
				<div className="flex flex-col" style={stackStyle}>
					<EngineBanner
						title="Minta-adat."
						text="A kártyák a TipCard bemutatására szolgálnak; a valódi ajánlásokat a modell a mentett meccs- és odds-adatból számolja majd."
					/>
					<section aria-labelledby="tips-today">
						<div className="oe-section-head">
							<h2 className="oe-h2" id="tips-today">
								Ma
							</h2>
							<span className="oe-muted text-small">{this.tips.length} tipp</span>
						</div>
						<div className="oe-card-grid">
							{this.tips.map((tip) => (
								<TipCard
									key={tip.id}
									tip={tip}
									selected={selectedIds.includes(tip.id)}
									expanded={expandedId === tip.id}
									onToggleSlip={this.toggleSlip}
									onToggleExpand={this.toggleExpand}
								>
									<MatchDetails tip={tip} />
								</TipCard>
							))}
						</div>
					</section>
				</div>
			</>
		);
	}
}

export default RecommendationsPage;
