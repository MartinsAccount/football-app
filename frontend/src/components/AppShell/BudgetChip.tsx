import React, { Component } from 'react';
import type { BudgetResponse } from '@football/contract';
import { budgetView, DAILY_CALL_LIMIT, IBudgetView } from '@football/core';
import { loadErrorText } from '../PageIntro/RemoteData';
import { card, cx, statLabel, statValue } from '../ui/oeClasses';
import { readApi } from '../../services/readApi';

interface IBudgetChipProps {
	/** Fixture módban „Mentett adat”, különben „Élő adat”. */
	fixture: boolean;
	/** A böngésző saját hívásszámlálója (`MainStore.fetchNumber`): tartalék, amíg a `/api/budget` nem válaszol. */
	localCalls: number;
	/** Tesztben/képernyőképhez cserélhető forrás. */
	load?: () => Promise<BudgetResponse>;
	now?: () => Date;
}

type BudgetState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; view: IBudgetView };

const PANEL_ID = 'oe-budget-panel';

const TONE_FILL: Record<IBudgetView['tone'], string | undefined> = {
	ok: undefined,
	warning: 'var(--color-signal-warning)',
	danger: 'var(--color-signal-negative)'
};

/**
 * Budget-panel (I19, ROADMAP 2.4): a fejléc állapot-pillje gomb, alatta lenyíló kártya a mai hívás-kerettel, jobonkénti
 * bontással, a `/status`-egyeztetéssel és az ütemező-futásokkal (`GET /api/budget`). Nézet-logika: core `budgetView`.
 * TODO(polish): kattintás a panelen kívül zárja; automatikus frissítés nyitva tartott panelnél.
 */
class BudgetChip extends Component<IBudgetChipProps, { open: boolean; data: BudgetState }> {
	state = { open: false, data: { status: 'loading' } as BudgetState };
	private alive = false;

	componentDidMount() {
		this.alive = true;
		this.reload();
	}

	componentWillUnmount() {
		this.alive = false;
	}

	reload = () => {
		const load = this.props.load ?? readApi.getBudget;
		const now = this.props.now ?? (() => new Date());
		load().then(
			(b) => this.alive && this.setState({ data: { status: 'ready', view: budgetView(b, now()) } }),
			(e) => this.alive && this.setState({ data: { status: 'error', message: loadErrorText(e) } })
		);
	};

	toggle = () => {
		const open = !this.state.open;
		this.setState({ open });
		if (open) this.reload();
	};

	onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Escape' && this.state.open) this.setState({ open: false });
	};

	renderPanel() {
		const s = this.state.data;
		if (s.status === 'loading') return <p className="oe-muted m-0">Betöltés…</p>;
		if (s.status === 'error')
			return (
				<p className="oe-muted m-0">A napi keret nem érhető el ({s.message}). A pill a böngésző saját számlálóját mutatja.</p>
			);
		const v = s.view;
		const fill = TONE_FILL[v.tone];
		const bar = { '--p': `${v.usedPct}%` } as React.CSSProperties;
		return (
			<>
				<div className="grid grid-cols-3 gap-sp-5">
					{v.stats.map((st) => (
						<div key={st.label} className="flex flex-col">
							<span className={statLabel}>{st.label}</span>
							<span className={statValue}>{st.value}</span>
						</div>
					))}
				</div>
				<div className="oe-pbar" style={bar} role="img" aria-label={`A napi keret ${v.usedPct}%-a elfogyott`}>
					<div className="oe-pbar__fill" style={fill ? { background: fill } : undefined} />
				</div>
				<div className="flex flex-col gap-sp-3">
					<span className="oe-label">Jobonként (ma, UTC)</span>
					{v.jobs.length ? (
						<ul className="m-0 flex list-none flex-col gap-sp-2 p-0">
							{v.jobs.map((j) => (
								<li key={j.key} className="flex justify-between gap-sp-5 text-small">
									<span>{j.label}</span>
									<span className="tabular-nums">
										{j.live}
										{j.mock && <span className="oe-muted"> + {j.mock} mock</span>}
									</span>
								</li>
							))}
						</ul>
					) : (
						<p className="oe-muted m-0 text-small">Ma még nem volt hívás.</p>
					)}
				</div>
				<p className="m-0 text-small" data-state={v.reconciliation.state}>
					{v.reconciliation.text}
				</p>
				<p className="oe-muted m-0 text-small">{v.cron}</p>
			</>
		);
	}

	render() {
		const { fixture, localCalls } = this.props;
		const s = this.state;
		const count = s.data.status === 'ready' ? s.data.view.pill : `${localCalls}/${DAILY_CALL_LIMIT} hívás`;
		return (
			<div className="relative" onKeyDown={this.onKeyDown}>
				<button
					type="button"
					className="oe-status-pill min-h-touch cursor-pointer bg-transparent"
					data-state={fixture ? 'saved' : 'live'}
					aria-expanded={s.open}
					aria-controls={PANEL_ID}
					onClick={this.toggle}
				>
					<span role="status">
						{fixture ? 'Mentett adat' : 'Élő adat'} · {count}
					</span>
				</button>
				<div
					id={PANEL_ID}
					className={cx(
						card,
						'absolute right-0 top-full z-10 mt-sp-4 w-[var(--size-aside-basis)] max-sm:fixed max-sm:inset-x-[var(--size-gutter-mobile)] max-sm:top-auto max-sm:w-auto',
						!s.open && 'hidden'
					)}
					hidden={!s.open}
					aria-label="Napi API-keret"
					role="region"
				>
					<strong>Napi API-keret</strong>
					{this.renderPanel()}
				</div>
			</div>
		);
	}
}

export default BudgetChip;
