import { ApiError } from '@football/contract';
import { AuthStore, loginErrorText, type IAuthApi } from './AuthStore';

const api = (over: Partial<IAuthApi> = {}): IAuthApi => ({
	getSession: async () => ({ authenticated: false, loginEnabled: true }),
	login: async () => ({ authenticated: true }),
	logout: async () => ({ authenticated: false }),
	...over
});

describe('AuthStore', () => {
	it('check: a szerver válasza szerint anonymous / authenticated, a loginEnabled átveszi', async () => {
		const s = new AuthStore(api());
		expect(s.status).toBe('checking');
		await s.check();
		expect(s.status).toBe('anonymous');

		const off = new AuthStore(api({ getSession: async () => ({ authenticated: true, loginEnabled: false }) }));
		await off.check();
		expect([off.status, off.loginEnabled]).toEqual(['authenticated', false]);
	});

	it('check: elérhetetlen /api/session (offline, régi szerver) → átengedi az appot', async () => {
		const s = new AuthStore(api({ getSession: async () => Promise.reject(new ApiError(0, 'network', 'offline')) }));
		await s.check();
		expect(s.status).toBe('authenticated');
	});

	it('login: hibás jelszó → hibaüzenet és anonymous marad; jó jelszó → authenticated; logout → anonymous', async () => {
		let ok = false;
		const s = new AuthStore(
			api({
				login: async () => (ok ? { authenticated: true } : Promise.reject(new ApiError(401, 'unauthorized', 'Hibás jelszó')))
			})
		);
		await s.check();
		await s.login('rossz');
		expect([s.status, s.error, s.submitting]).toEqual(['anonymous', 'Hibás jelszó.', false]);
		ok = true;
		await s.login('jo');
		expect([s.status, s.error]).toEqual(['authenticated', null]);
		await s.logout();
		expect(s.status).toBe('anonymous');
	});

	it('loginErrorText: 429 a szerver szövegét adja, hálózati hiba saját szöveget', () => {
		expect(loginErrorText(new ApiError(429, 'rate-limited', 'Túl sok hibás próbálkozás, próbáld újra 15 perc múlva'))).toBe(
			'Túl sok hibás próbálkozás, próbáld újra 15 perc múlva'
		);
		expect(loginErrorText(new ApiError(0, 'network', 'x'))).toBe('Nincs kapcsolat a szerverrel. Próbáld újra később.');
	});
});
