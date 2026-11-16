import { createApiClient } from '@football/contract';

/**
 * Az olvasó API (`@football/server`, ROADMAP 1.5/1.8) kliense. Azonos origin: dev módban a Vite-proxy a
 * `/api/fixtures`, `/api/odds/:id`, `/api/budget`, `/api/settings` stb. útvonalakat a :5100-ra küldi (vite.config.ts).
 */
export const readApi = createApiClient({ baseUrl: '' });
