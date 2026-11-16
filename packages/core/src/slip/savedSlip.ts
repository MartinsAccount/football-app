import { parseJsonOrNull, StoredValueCodec } from '../storage/keyValue';

// Mentett (megtett) szelvények tárolt alakja (PRD 7.3, ROADMAP 11.4). Fogadásleadás nincs (PRD 8).

/** A mentett szelvény szerver-szinkron állapota. */
export type SlipSync = 'server' | 'local' | 'failed';

/** Mentett szelvény: beírt Tippmix-odds + tét. */
export interface ISavedSlip {
	id: string;
	savedAt: string;
	stake: number;
	combinedOdds: number;
	probability: number;
	ev: number;
	/**
	 * Szerver-szinkron (I23b, DECISIONS): `server` = rögzítve a `placed_bet`-ben (`serverBetId`), `local` = csak helyben
	 * (kombinált szelvény vagy nem elszámolható piac), `failed` = a feltöltés nem sikerült. Hiányzik = I23b előtti mentés.
	 */
	sync?: SlipSync;
	serverBetId?: number | null;
	legs: {
		tipId: string;
		fixtureId: number;
		pairing: string;
		tippmixLabel: string;
		kickoff: string;
		pModel: number;
		minOdds: number;
		tippmixOdds: number;
		modelVersion: string;
		/** Snapshot-kimenet (`Home`/`Draw`/`Away`/`Over`/`Under`); I23b előtti mentésben nincs. */
		outcome?: string;
	}[];
}

/** A webes localStorage-kulcs (változatlan). */
export const SAVED_SLIPS_STORAGE_KEY = 'oe_saved_slips';

/** v1 = verziómező nélküli `ISavedSlip[]` JSON (a mai mentés); formátumváltáskor itt jön az ág. */
export const migrateSavedSlips = (raw: unknown): unknown => raw;

const looksLikeSlip = (x: unknown): x is ISavedSlip =>
	!!x && typeof x === 'object' && typeof (x as ISavedSlip).id === 'string' && Array.isArray((x as ISavedSlip).legs);

/** Tárolt érték → szelvénylista; nem tömb → üres, a felismerhetetlen elemek kiesnek. */
export const normalizeSavedSlips = (raw: unknown): ISavedSlip[] => (Array.isArray(raw) ? raw.filter(looksLikeSlip) : []);

export const savedSlipsCodec: StoredValueCodec<ISavedSlip[]> = {
	key: SAVED_SLIPS_STORAGE_KEY,
	decode: (raw) => normalizeSavedSlips(migrateSavedSlips(parseJsonOrNull(raw))),
	encode: (slips) => JSON.stringify(slips)
};
