import React, { Component, ReactNode } from 'react';
import { ApiError } from '@football/contract';
import PageHead from './PageHead';
import { card, dangerBox } from '../ui/oeClasses';

/** Hibaüzenet az olvasó API hibájából: hálózati hiba, nincs még pillanatkép (404), vagy egyéb HTTP-hiba. */
export function loadErrorText(e: unknown): string {
	if (e instanceof ApiError) {
		// 0 = hálózati hiba; JSON-hibatest nélküli 5xx = a dev-proxy nem éri el a szervert.
		if (e.status === 0 || (e.error === 'http' && e.status >= 500))
			return 'Az olvasó API nem érhető el. Fut a szerver? (npm run dev -w @football/server)';
		if (e.status === 404) return 'Még nincs mentett pillanatkép ehhez az oldalhoz.';
		return `Az olvasó API hibát adott (${e.status}): ${e.message}`;
	}
	return e instanceof Error ? e.message : String(e);
}

interface IRemoteDataProps<T> {
	/** Oldalcím a betöltés- és hibaállapot fejéhez. */
	title: string;
	load: () => Promise<T>;
	children: (data: T) => ReactNode;
}

type IRemoteDataState<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T };

/**
 * Olvasó-API adatbetöltés egy oldalnak (SB5): betöltés közben és hibánál kompakt oldalfej + állapotkártya (újrapróbálással),
 * siker után a `children(data)`. TODO(polish): skeleton a kártya helyett, cache oldalváltások között.
 */
class RemoteData<T> extends Component<IRemoteDataProps<T>, IRemoteDataState<T>> {
	state: IRemoteDataState<T> = { status: 'loading' };
	private alive = false;

	componentDidMount() {
		this.alive = true;
		this.fetch();
	}

	componentWillUnmount() {
		this.alive = false;
	}

	fetch = () => {
		this.setState({ status: 'loading' });
		this.props.load().then(
			(data) => this.alive && this.setState({ status: 'ready', data }),
			(e) => this.alive && this.setState({ status: 'error', message: loadErrorText(e) })
		);
	};

	render() {
		const { state } = this;
		if (state.status === 'ready') return this.props.children(state.data);
		return (
			<div className="oe-stack">
				<PageHead title={this.props.title} />
				{state.status === 'loading' ? (
					<div className={card} role="status" aria-busy="true">
						<p className="oe-muted m-0">Betöltés…</p>
					</div>
				) : (
					<div className={card} role="alert">
						<h2 className="oe-h2">Nem sikerült betölteni</h2>
						<p className={`${dangerBox} m-0`}>{state.message}</p>
						<div>
							<button type="button" className="oe-btn oe-btn--neutral" onClick={this.fetch}>
								Újra
							</button>
						</div>
					</div>
				)}
			</div>
		);
	}
}

export default RemoteData;
