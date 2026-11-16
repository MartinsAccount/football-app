import { settlePlacedBet, summarizeOwnBets, type EvaluationRecord } from '@football/core';
import type { PlacedBetInput, PlacedBetRepository } from '@football/db';
import type { PlacedBetsResponse } from '@football/contract';

/**
 * Fogadás-rögzítés API (ROADMAP 5.6, I23): `GET /api/bets` (lista + saját vs. modell ROI) és `POST /api/bets` (egy megtett
 * tipp). Csak rögzítés – bukmékerhez leadás nincs (PRD 8). Hibás törzs → `PlacedBetValidationError` (a router 400-ra fordítja).
 */
export class PlacedBetValidationError extends Error {}

const MAX_ODD = 9999.999; // numeric(7, 3)
const MAX_STAKE = 9_999_999_999.99; // numeric(12, 2)
const MAX_LINE = 999.99; // numeric(5, 2)
export const DEFAULT_BOOKMAKER_LABEL = 'Tippmix';

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const isPosInt = (x: unknown): x is number => typeof x === 'number' && Number.isSafeInteger(x) && x > 0;

function optText(body: Record<string, unknown>, key: string, max: number): string | null {
	const v = body[key];
	if (v === undefined || v === null) return null;
	if (typeof v !== 'string') throw new PlacedBetValidationError(`'${key}' szöveg legyen`);
	const t = v.trim();
	if (t.length > max) throw new PlacedBetValidationError(`'${key}' legfeljebb ${max} karakter`);
	return t || null;
}

/** A `POST /api/bets` törzs teljes validálása (a DB-hivatkozásokat a repository ellenőrzi). */
export function parsePlacedBetInput(body: unknown): PlacedBetInput {
	if (!isObject(body)) throw new PlacedBetValidationError('A törzs objektum legyen');
	const { fixtureId, marketId, selection, oddTaken, stake } = body;
	if (!isPosInt(fixtureId)) throw new PlacedBetValidationError("'fixtureId' pozitív egész legyen");
	if (!isPosInt(marketId)) throw new PlacedBetValidationError("'marketId' pozitív egész legyen");
	if (typeof selection !== 'string' || !selection.trim() || selection.length > 50)
		throw new PlacedBetValidationError("'selection' nem üres szöveg legyen (legfeljebb 50 karakter)");
	const line = body.line ?? null;
	if (line !== null && !(typeof line === 'number' && Number.isFinite(line) && Math.abs(line) <= MAX_LINE))
		throw new PlacedBetValidationError("'line' szám vagy null legyen");
	if (!(typeof oddTaken === 'number' && oddTaken > 1 && oddTaken <= MAX_ODD))
		throw new PlacedBetValidationError(`'oddTaken' 1-nél nagyobb szám legyen (legfeljebb ${MAX_ODD})`);
	if (!(typeof stake === 'number' && stake > 0 && stake <= MAX_STAKE))
		throw new PlacedBetValidationError("'stake' pozitív szám legyen");
	const predictionId = body.predictionId ?? null;
	if (predictionId !== null && !isPosInt(predictionId))
		throw new PlacedBetValidationError("'predictionId' pozitív egész vagy null legyen");
	const placedAt = optText(body, 'placedAt', 40);
	if (placedAt !== null && Number.isNaN(Date.parse(placedAt)))
		throw new PlacedBetValidationError("'placedAt' nem értelmezhető időpont");
	return {
		fixtureId,
		marketId,
		selection: selection.trim(),
		line,
		oddTaken,
		stake,
		predictionId,
		bookmakerLabel: body.bookmakerLabel === undefined ? DEFAULT_BOOKMAKER_LABEL : optText(body, 'bookmakerLabel', 60),
		placedAt: placedAt === null ? null : new Date(placedAt).toISOString(),
		note: optText(body, 'note', 500)
	};
}

/** `GET /api/bets`: elszámolt lista + saját vs. modell ROI (a modell-oldal a kiértékelt predikciókból). */
export async function readPlacedBets(
	repo: Pick<PlacedBetRepository, 'list'>,
	evaluations: () => Promise<EvaluationRecord[]>
): Promise<PlacedBetsResponse> {
	const placed = await repo.list();
	return { bets: placed.map(settlePlacedBet), summary: summarizeOwnBets(placed, await evaluations()) };
}
