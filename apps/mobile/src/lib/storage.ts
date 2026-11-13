import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStorage } from '@football/core';

/** A core `KeyValueStorage` szerződése AsyncStorage fölött (nem titkos adat: cache, beállítások). */
export const asyncKeyValueStorage: KeyValueStorage = {
	getItem: (key) => AsyncStorage.getItem(key),
	setItem: (key, value) => AsyncStorage.setItem(key, value),
	removeItem: (key) => AsyncStorage.removeItem(key)
};

/** Az utolsó sikeres `/api/fixtures` válasz kulcsa. */
export const FIXTURES_CACHE_KEY = 'oe_cache_fixtures';
