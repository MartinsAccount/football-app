import { isFixtureMode } from './dataMode';
import { resolveFixture } from './fixtures/fixtureResolver';

type ISports = 'football' | 'baseball' | 'basketball';

class FetchService {
	// private myHeaders = new Headers();

	constructor() {
		// this.myHeaders.append('x-rapidapi-key', API_KEY);
	}

	public async get(url: string, sport: ISports = 'football') {
		// Fixture-mód: mentett válasz, nincs élő hívás (ROADMAP 0.5).
		if (isFixtureMode()) return resolveFixture(url);

		let myHeaders = new Headers();

		// A kulcs a frontend/.env-ből jön (minta: .env.example) — kódba kulcsot nem írunk.
		const API_KEY = import.meta.env.VITE_APISPORTS_KEY ?? '';

		if (sport === 'football') myHeaders.append('x-rapidapi-host', 'v3.football.api-sports.io');
		if (sport === 'basketball') myHeaders.append('x-rapidapi-host', 'v1.basketball.api-sports.io');
		if (sport === 'baseball') myHeaders.append('x-rapidapi-host', 'v1.baseball.api-sports.io');

		myHeaders.append('x-rapidapi-key', API_KEY);

		const requestOptions: RequestInit = {
			method: 'GET',
			headers: myHeaders,
			redirect: 'follow'
		};

		let result = null;

		result = await fetch(url, requestOptions);

		if (result.ok) return result.json();
		throw result;
	}

	// TODO: body type
	public async post(url: string, body: any) {
		try {
			const requestOptions: RequestInit = {
				method: 'POST',
				mode: 'cors' as RequestMode,
				body: JSON.stringify(body),
				headers: {
					'Content-Type': 'application/json'
				}
			};

			let result = null;

			result = await fetch(url, requestOptions);

			if (result.ok) return result.json();
			throw result;
		} catch (e) {
			console.log(e);
		}
	}
}

export default new FetchService();
