import { ApiFootballClient, type ApiFootballClientOptions } from './client';
import type { ClientMode } from './types';

export interface ApiFootballEnv {
	API_FOOTBALL_KEY?: string;
	API_FOOTBALL_HOST?: string;
	API_FOOTBALL_MODE?: string;
}

/** Az env értelmezése: alapból mock (0 élő hívás); élő módhoz `API_FOOTBALL_MODE=live` + `API_FOOTBALL_KEY` kell. */
export function readApiFootballEnv(env: ApiFootballEnv): { mode: ClientMode; apiKey?: string; host?: string } {
	const raw = (env.API_FOOTBALL_MODE ?? 'mock').trim().toLowerCase();
	if (raw !== 'mock' && raw !== 'live') throw new Error(`API_FOOTBALL_MODE must be mock|live, got "${raw}"`);
	return { mode: raw, apiKey: env.API_FOOTBALL_KEY || undefined, host: env.API_FOOTBALL_HOST || undefined };
}

/** Kliens a (szerveroldali) környezetből; a többi függőség (budget, logger, fixtures) paraméterként. */
export function createClientFromEnv(
	env: ApiFootballEnv,
	deps: Omit<ApiFootballClientOptions, 'mode' | 'apiKey' | 'host'> = {}
): ApiFootballClient {
	return new ApiFootballClient({ ...readApiFootballEnv(env), ...deps });
}
