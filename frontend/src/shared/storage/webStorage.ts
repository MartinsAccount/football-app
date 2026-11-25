import type { KeyValueStorage, SyncKeyValueStorage } from '@football/core';

const ls = (): Storage | null => (typeof window === 'undefined' ? null : window.localStorage);

/**
 * A core `KeyValueStorage` webes adaptere (localStorage). A szinkron gyors út miatt a store-ok induláskor szinkron
 * olvasnak (nincs villanás); az async felület a mobillal közös kódnak szól. Olvasási hiba → `null`; írási hibát
 * (kvóta, tiltott tároló) a hívó kezeli – ahogy eddig.
 */
export const webStorage: KeyValueStorage & SyncKeyValueStorage = {
	getItemSync: (key) => {
		try {
			return ls()?.getItem(key) ?? null;
		} catch {
			return null;
		}
	},
	setItemSync: (key, value) => ls()?.setItem(key, value),
	removeItemSync: (key) => ls()?.removeItem(key),
	getItem: async (key) => webStorage.getItemSync(key),
	setItem: async (key, value) => webStorage.setItemSync(key, value),
	removeItem: async (key) => webStorage.removeItemSync(key)
};
