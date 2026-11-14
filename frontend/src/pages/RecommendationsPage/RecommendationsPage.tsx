import React, { Component, CSSProperties } from 'react';
import { inject, observer } from 'mobx-react';
import { RecommendationSnapshot } from '@football/core';
import PageIntro from '../../components/PageIntro/PageIntro';
import EmptyState from '../../components/PageIntro/EmptyState';
import DataState from '../../components/PageIntro/DataState';
import MatchDetails from '../../components/MatchDetails/MatchDetails';
import SlipPanel from '../../components/SlipPanel/SlipPanel';
import TipCard from '../../components/TipCard/TipCard';
import { ITip } from '../../components/TipCard/tipView';
import { v } from '../../design/tokens/tokens';
import { MainStore } from '../../stores/MainStore';
import RemoteData from '../../components/PageIntro/RemoteData';
import { readApi } from '../../services/readApi';
import { dataState, groupTipsByDay, ITipDay } from './recommendationsView';

const splitStyle: CSSProperties = { paddingBottom: v('space.14') };

interface IRecommendationsPageProps {
	MainStore?: MainStore;
	snapshot: RecommendationSnapshot;
}

interface IRecommendationsPageState {
	expandedId: string | null;
}

/**
 * `/` – Ma: ajánlások TipCard-okkal (PRD 5.8, ROADMAP 5.4) a mentett ajánlás-pillanatképből (olvasó API `/api/recommendations`,
 * SB5; 0 külső hívás). A pillanatkép: `npm run recommendations -w @football/db`. Szelvény: SlipStore + SlipPanel.
 */
@inject('MainStore')
@observer
class RecommendationsView extends Component<IRecommendationsPageProps, IRecommendationsPageState> {
	snapshot = this.props.snapshot;
	now = new Date(this.snapshot.now);
	days: ITipDay[] = groupTipsByDay(this.snapshot);
	allTips: ITip[] = this.days.flatMap((d) => d.tips);
	tipCount = this.allTips.length;
	dataRow = dataState(this.snapshot);
	// Az első kártya nyitva indul (DESIGN-referencia).
	state: IRecommendationsPageState = {
		expandedId: this.days.find((d) => d.tips.length)?.tips[0].id ?? null
	};

	get slip() {
		return this.props.MainStore!.SlipStore;
	}

	toggleSlip = (tip: ITip) => this.slip.toggle(tip);

	// Egyszerre egy kártya lehet nyitva (DESIGN §7.4).
	toggleExpand = (tip: ITip) => this.setState(({ expandedId }) => ({ expandedId: expandedId === tip.id ? null : tip.id }));

	renderDay(day: ITipDay) {
		const { expandedId } = this.state;
		const { slip } = this;
		const headingId = `tips-${day.key}`;
		return (
			<section key={day.key} aria-labelledby={headingId}>
				<div className="oe-section-head">
					<h2 className="oe-h2" id={headingId}>
						{day.title}
					</h2>
					<span className="oe-section-sub">{day.tips.length} tipp</span>
				</div>
				{day.tips.length === 0 ? (
					<p className="oe-muted m-0">Erre a napra nincs a szabályoknak megfelelő tipp.</p>
				) : (
					<div>
						{day.tips.map((tip) => (
							<TipCard
								key={tip.id}
								tip={tip}
								now={this.now}
								selected={slip.isSelected(tip.id)}
								blockedReason={slip.blockedReason(tip)}
								expanded={expandedId === tip.id}
								onToggleSlip={this.toggleSlip}
								onToggleExpand={this.toggleExpand}
							>
								<MatchDetails tip={tip} />
							</TipCard>
						))}
					</div>
				)}
			</section>
		);
	}

	render() {
		const { snapshot, now, tipCount, dataRow } = this;
		return (
			<>
				<PageIntro
					title="Rakd össze a mai szelvényt."
					subtitle={`${snapshot.analyzed} meccsből ${tipCount} érték-tipp.`}
					date={now}
				>
					<DataState label={dataRow.label} chips={dataRow.chips} detail={dataRow.detail} />
				</PageIntro>
				<div className="oe-split" style={splitStyle}>
					<div className="oe-split__main">
						{tipCount === 0 ? (
							<EmptyState
								title="Ma nincs érték-tipp."
								text="A modell minden meccset átnézett, de egyik sem ment át az EV-, eltérés- és odds-szűrőn."
							/>
						) : (
							this.days.map((day) => this.renderDay(day))
						)}
					</div>
					<SlipPanel store={this.slip} now={now} presetTips={this.allTips} />
				</div>
			</>
		);
	}
}

const RecommendationsPage = () => (
	<RemoteData title="Ma" load={readApi.getRecommendations}>
		{(snapshot) => <RecommendationsView snapshot={snapshot} />}
	</RemoteData>
);

export default RecommendationsPage;
