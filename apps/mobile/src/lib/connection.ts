import * as SecureStore from 'expo-secure-store';
import { createApiClient, type ApiClient } from '@football/contract';

/**
 * API-kapcsolat: base URL + Bearer token (ADR-0005), mindkettő `expo-secure-store`-ban.
 * A tokent SOHA ne írd logba / hibaüzenetbe.
 */
export interface Connection {
	baseUrl: string;
	token: string;
}

const BASE_URL_KEY = 'oe_api_base_url';
const TOKEN_KEY = 'oe_api_token';

export const loadConnection = async (): Promise<Connection> => ({
	baseUrl: (await SecureStore.getItemAsync(BASE_URL_KEY)) ?? '',
	token: (await SecureStore.getItemAsync(TOKEN_KEY)) ?? ''
});

export const saveConnection = async ({ baseUrl, token }: Connection): Promise<void> => {
	const url = baseUrl.trim().replace(/\/+$/, '');
	if (url) await SecureStore.setItemAsync(BASE_URL_KEY, url);
	else await SecureStore.deleteItemAsync(BASE_URL_KEY);
	if (token.trim()) await SecureStore.setItemAsync(TOKEN_KEY, token.trim());
	else await SecureStore.deleteItemAsync(TOKEN_KEY);
};

export const apiClientFor = ({ baseUrl, token }: Connection): ApiClient =>
	createApiClient({ baseUrl, token: token || undefined });
