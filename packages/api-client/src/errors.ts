export type ApiErrorKind = 'budget' | 'plan' | 'quota' | 'token' | 'http' | 'api' | 'mock-missing';

/** Minden sikertelen hívás ezt dobja; `retryable` csak átmeneti hibánál (HTTP 5xx / 429) igaz. */
export class ApiFootballError extends Error {
	constructor(
		readonly kind: ApiErrorKind,
		message: string,
		readonly details: { endpoint: string; httpStatus?: number; errors?: unknown } = { endpoint: '' }
	) {
		super(message);
		this.name = 'ApiFootballError';
	}

	get retryable(): boolean {
		return this.kind === 'http' && (this.details.httpStatus === 429 || (this.details.httpStatus ?? 0) >= 500);
	}
}

/** Üres-e az `errors` mező (tömb vagy objektum). */
export function hasErrors(errors: unknown): boolean {
	if (errors == null) return false;
	if (Array.isArray(errors)) return errors.length > 0;
	if (typeof errors === 'object') return Object.keys(errors as object).length > 0;
	return Boolean(errors);
}

/** Az `errors` mezőből hibafajta + üzenet. Az `errors.plan` esetén nincs újrapróbálás (ugyanaz jönne, és fogy a kvóta). */
export function classifyErrors(errors: unknown): { kind: ApiErrorKind; message: string } {
	const entries: [string, string][] = Array.isArray(errors)
		? errors.map((e, i) => [String(i), typeof e === 'string' ? e : JSON.stringify(e)])
		: Object.entries(errors as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
	const keys = entries.map(([k]) => k);
	const message = entries.map(([k, v]) => (/^\d+$/.test(k) ? v : `${k}: ${v}`)).join('; ');
	const kind: ApiErrorKind = keys.includes('plan')
		? 'plan'
		: keys.includes('requests')
		? 'quota'
		: keys.includes('token')
		? 'token'
		: 'api';
	return { kind, message };
}
