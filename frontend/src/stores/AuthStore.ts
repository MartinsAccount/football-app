import { action, flow, makeObservable, observable } from 'mobx';
import { ApiError, type SessionResponse } from '@football/contract';

/** A web-login állapota (I31). `checking` = a `GET /api/session` még fut. */
export type AuthStatus = 'checking' | 'anonymous' | 'authenticated';

export interface IAuthApi {
	getSession(): Promise<SessionResponse>;
	login(password: string): Promise<unknown>;
	logout(): Promise<unknown>;
}

/** Hibaüzenet a login-űrlapra (DESIGN §9: tegeződő, rövid, felkiáltójel nélkül). */
export function loginErrorText(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.status === 401) return 'Hibás jelszó.';
		if (e.status === 429) return e.message;
		if (e.status === 0) return 'Nincs kapcsolat a szerverrel. Próbáld újra később.';
		return e.message || `Hiba történt (HTTP ${e.status}).`;
	}
	return 'Hiba történt. Próbáld újra.';
}

/**
 * Egyfelhasználós web-login (I31). Az app a `MainStore`-ral együtt csak `authenticated` állapotban épül fel, így belépés
 * előtt nem indul 401-es kérés-áradat. Ha a `/api/session` nem érhető el (offline, vagy régi szerver az útvonal nélkül),
 * az appot átengedjük: a védett hívások úgyis 401-et adnak, offline pedig a gyorsítótár szolgál ki.
 */
export class AuthStore {
	@observable status: AuthStatus = 'checking';
	@observable loginEnabled: boolean = true;
	@observable submitting: boolean = false;
	@observable error: string | null = null;

	constructor(private readonly api: IAuthApi) {
		makeObservable(this);
	}

	check = flow(function* (this: AuthStore) {
		try {
			const s: SessionResponse = yield this.api.getSession();
			this.loginEnabled = s.loginEnabled;
			this.status = s.authenticated ? 'authenticated' : 'anonymous';
		} catch {
			this.status = 'authenticated';
		}
	});

	login = flow(function* (this: AuthStore, password: string) {
		if (this.submitting) return;
		this.submitting = true;
		this.error = null;
		try {
			yield this.api.login(password);
			this.status = 'authenticated';
		} catch (e) {
			this.error = loginErrorText(e);
		} finally {
			this.submitting = false;
		}
	});

	logout = flow(function* (this: AuthStore) {
		try {
			yield this.api.logout();
		} catch {
			// a süti lejár magától; a felületet így is kiléptetjük
		}
		this.status = 'anonymous';
	});

	@action clearError() {
		this.error = null;
	}
}
