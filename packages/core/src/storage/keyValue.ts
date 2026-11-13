// Platformfüggetlen kulcs–érték tároló (ROADMAP 11.4). A core csak a szerződést és egy memória-implementációt ad;
// a webes adapter (localStorage) a frontendben, a mobilos (AsyncStorage) az `apps/mobile`-ban él.

/** Async tároló: a mobil (AsyncStorage) csak így tud; a web adaptere is teljesíti. */
export interface KeyValueStorage {
	getItem(key: string): Promise<string | null>;
	setItem(key: string, value: string): Promise<void>;
	removeItem(key: string): Promise<void>;
}

/**
 * Szinkron gyors út (opcionális): a web localStorage-a induláskor szinkron olvasható, így a store-ok első festése
 * villanás nélkül a mentett állapotot mutatja. Async-only platformon a store alapértékkel indul, majd betölt.
 */
export interface SyncKeyValueStorage {
	getItemSync(key: string): string | null;
	setItemSync(key: string, value: string): void;
	removeItemSync(key: string): void;
}

export type MemoryKeyValueStorage = KeyValueStorage & SyncKeyValueStorage & { snapshot(): Record<string, string> };

/** Memória-tároló tesztekhez (és ahol nincs tartós tároló). */
export const memoryKeyValueStorage = (initial: Record<string, string> = {}): MemoryKeyValueStorage => {
	const data = new Map(Object.entries(initial));
	const getItemSync = (key: string) => data.get(key) ?? null;
	const setItemSync = (key: string, value: string) => void data.set(key, value);
	const removeItemSync = (key: string) => void data.delete(key);
	return {
		getItemSync,
		setItemSync,
		removeItemSync,
		getItem: async (key) => getItemSync(key),
		setItem: async (key, value) => setItemSync(key, value),
		removeItem: async (key) => removeItemSync(key),
		snapshot: () => Object.fromEntries(data)
	};
};

/** Egy tárolt érték kódolása: kulcs + (de)szerializálás. A `decode` sosem dob: sérült / hiányzó adat → alapérték. */
export interface StoredValueCodec<T> {
	key: string;
	decode(raw: string | null): T;
	/** `null` → a kulcs törlendő (pl. téma „system”). */
	encode(value: T): string | null;
}

/** JSON-olvasás, ami hibára `null`-t ad (sérült tároló ne törje az indulást). */
export const parseJsonOrNull = (raw: string | null): unknown => {
	if (raw === null || raw === '') return null;
	try {
		return JSON.parse(raw);
	} catch {
		return null;
	}
};

export const loadStored = async <T>(storage: KeyValueStorage, codec: StoredValueCodec<T>): Promise<T> => {
	let raw: string | null = null;
	try {
		raw = await storage.getItem(codec.key);
	} catch {
		// olvashatatlan tároló → alapérték
	}
	return codec.decode(raw);
};

export const loadStoredSync = <T>(storage: SyncKeyValueStorage, codec: StoredValueCodec<T>): T => {
	let raw: string | null = null;
	try {
		raw = storage.getItemSync(codec.key);
	} catch {
		// olvashatatlan tároló → alapérték
	}
	return codec.decode(raw);
};

export const saveStored = async <T>(storage: KeyValueStorage, codec: StoredValueCodec<T>, value: T): Promise<void> => {
	const encoded = codec.encode(value);
	if (encoded === null) await storage.removeItem(codec.key);
	else await storage.setItem(codec.key, encoded);
};

/** Szinkron írás; a hibát (pl. kvóta) a hívó kezeli. */
export const saveStoredSync = <T>(storage: SyncKeyValueStorage, codec: StoredValueCodec<T>, value: T): void => {
	const encoded = codec.encode(value);
	if (encoded === null) storage.removeItemSync(codec.key);
	else storage.setItemSync(codec.key, encoded);
};
