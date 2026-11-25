import React from 'react';
import { ApiError, FixtureResponse, OddsHistoryResponse } from '@football/contract';
import {
	bookmakerName,
	formatDateTime,
	formatOdds,
	formatOddsChange,
	formatOddsPath,
	formatPairing,
	IHistoryMarket,
	IHistoryRow,
	matchResultText,
	oddsHistoryMarkets,
	peakPoint,
	SELECTION_RESULT_LABELS,
	selectionResult,
	snapshotKindLabel,
	withoutAggregateQuotes
} from '@football/core';
import PageHead from '../../components/PageIntro/PageHead';
import RemoteData from '../../components/PageIntro/RemoteData';
import EmptyState from '../../components/PageIntro/EmptyState';
import { card, statLabel } from '../../components/ui/oeClasses';
import { readApi } from '../../services/readApi';
import OddsSparkline from './OddsSparkline';

interface IMatchData {
	fixture: FixtureResponse;
	history: OddsHistoryResponse;
	names: Map<number, string>;
}

const at = (iso: string) => formatDateTime(new Date(iso));
const MOVE_ARROW = { up: '↑', down: '↓', flat: '→' } as const;
const RESULT_TONE = { win: 'good', loss: 'bad', void: undefined } as const;

/** Meccs + odds-history párhuzamosan; az iroda-nevek a `/api/settings`-ből (hibánál a core katalógusa). */
async function loadMatch(id: number): Promise<IMatchData> {
	try {
		const [fixture, history, settings] = await Promise.all([
			readApi.getFixture(id),
			readApi.getOddsHistory(id),
			readApi.getSettings().catch(() => null)
		]);
		return { fixture, history, names: new Map((settings?.bookmakers ?? []).map((b) => [b.id, b.name])) };
	} catch (e) {
		if (e instanceof ApiError && e.status === 404) throw new Error(`Ez a meccs (#${id}) nincs az adatbázisban.`);
		throw e;
	}
}

const HistoryRow = ({ row, market, data }: { row: IHistoryRow; market: IHistoryMarket; data: IMatchData }) => {
	const f = data.fixture;
	const result =
		f.goalsHome != null && f.goalsAway != null
			? selectionResult(market.marketId, market.line, row.selection, f.goalsHome, f.goalsAway)
			: null;
	const peak = peakPoint(row);
	return (
		<li className="grid grid-cols-2 items-center gap-sp-6 border-t border-border-default py-sp-6 first:border-t-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)]">
			<div className="flex min-w-0 flex-wrap items-center gap-sp-4">
				<strong>{row.outcomeLabel}</strong>
				{result && (
					<span className="oe-delta" data-tone={RESULT_TONE[result]}>
						{SELECTION_RESULT_LABELS[result]}
					</span>
				)}
			</div>
			<OddsSparkline
				odds={row.points.map((p) => p.odd)}
				label={`${row.outcomeLabel}: ${row.points.map((p) => formatOdds(p.odd)).join(', ')}`}
			/>
			<div className="tabular-nums">
				<div className="font-bold">{formatOddsPath(row)}</div>
				<div className="text-caption text-text-muted">
					{MOVE_ARROW[row.move]} {formatOddsChange(row.change)}
				</div>
			</div>
			<div className="min-w-0">
				<div className={statLabel}>Legjobb ajánlat</div>
				<div className="truncate">
					<strong className="tabular-nums">{formatOdds(peak.odd)}</strong> · {bookmakerName(peak.bookmakerId, data.names)}
				</div>
				<div className="text-caption text-text-muted">{at(peak.capturedAt)}</div>
			</div>
		</li>
	);
};

const MatchView = ({ data }: { data: IMatchData }) => {
	const { fixture: f, history } = data;
	const home = f.homeTeamName ?? `#${f.homeTeamId}`;
	const away = f.awayTeamName ?? `#${f.awayTeamId}`;
	const markets = oddsHistoryMarkets(withoutAggregateQuotes(history.snapshots));
	const result = matchResultText(f);
	const chips = [at(f.kickoffAt), f.round ?? '', f.status, `${history.snapshots.length} pillanatkép`].filter(Boolean);

	return (
		<div className="oe-stack">
			<PageHead title={formatPairing(home, away)} chips={chips} />

			<section className={card} aria-labelledby="h-result">
				<h2 className="oe-h2" id="h-result">
					Kimenetel
				</h2>
				<p className="m-0 text-num-s font-bold tabular-nums">{result ?? 'Még nem játszották le.'}</p>
				{f.referee && <p className="oe-muted m-0">Játékvezető: {f.referee}</p>}
			</section>

			<section aria-labelledby="h-moves">
				<div className="oe-section-head">
					<h2 className="oe-h2" id="h-moves">
						Odds-mozgás
					</h2>
					<span className="oe-section-sub">kimenetenként a legjobb odds pillanatképenként, nyitó → legutóbbi</span>
				</div>
				{markets.length === 0 ? (
					<EmptyState title="Nincs mentett odds" text="Ehhez a meccshez még nem készült odds-pillanatkép." />
				) : (
					<div className="flex flex-col gap-sp-6">
						{markets.map((m) => (
							<section key={m.key} className={card} aria-label={m.label}>
								<h3 className="oe-label m-0">{m.label}</h3>
								<ul className="m-0 list-none p-0">
									{m.rows.map((row) => (
										<HistoryRow key={row.key} row={row} market={m} data={data} />
									))}
								</ul>
							</section>
						))}
					</div>
				)}
			</section>

			{history.snapshots.length > 0 && (
				<section className={card} aria-labelledby="h-snaps">
					<h2 className="oe-h2" id="h-snaps">
						Pillanatképek
					</h2>
					<ul className="m-0 flex list-none flex-col gap-sp-4 p-0">
						{history.snapshots.map((s) => (
							<li key={s.id} className="flex flex-wrap gap-x-sp-5 text-small">
								<strong className="tabular-nums">{at(s.capturedAt)}</strong>
								<span className="oe-muted">
									{snapshotKindLabel(s.kind)} · {s.quotes.length} jegyzés · {new Set(s.quotes.map((q) => q.bookmakerId)).size}{' '}
									iroda
								</span>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
};

/**
 * Meccs-részlet (ROADMAP 5.7, I20): a meccs odds-pillanatképei, az odds mozgása kimenetenként (sparkline), a legjobb iroda és a
 * kimenetel. Adat: `GET /api/fixtures/:id` + `GET /api/odds/:id/history`; nézet-logika a core `odds/history.ts` +
 * `odds/matchView.ts`. TODO(polish): vissza-link a forráslistára; ajánlás/predikció ehhez a meccshez.
 */
const MatchPage = ({ id }: { id: number }) =>
	Number.isInteger(id) && id > 0 ? (
		<RemoteData key={id} title="Meccs" load={() => loadMatch(id)}>
			{(data) => <MatchView data={data} />}
		</RemoteData>
	) : (
		<EmptyState title="Érvénytelen meccs-azonosító" text="A címben szereplő azonosító nem pozitív egész szám." />
	);

export default MatchPage;
