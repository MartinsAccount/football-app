import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ApiHandler } from './router';

/** Node `http` → Web `Request`/`Response` híd a lokális futtatáshoz (Vercelen nem kell: ott a függvény Web API-t kap). */
export function toNodeListener(handler: ApiHandler, origin = 'http://localhost') {
	return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
		const url = new URL(req.url ?? '/', req.headers.host ? `http://${req.headers.host}` : origin);
		const response = await handler(new Request(url, { method: req.method ?? 'GET' }));
		res.statusCode = response.status;
		response.headers.forEach((value, key) => res.setHeader(key, value));
		res.end(Buffer.from(await response.arrayBuffer()));
	};
}
