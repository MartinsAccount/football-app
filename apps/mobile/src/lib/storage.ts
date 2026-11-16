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

/** Az utolsó sikeres `/api/backtest` válasz kulcsa. */
export const BACKTEST_CACHE_KEY = 'oe_cache_backtest';

/** Az utolsó sikeres `/api/recommendations` válasz kulcsa. */
export const RECOMMENDATIONS_CACHE_KEY = 'oe_cache_recommendations';

/** Az utolsó sikeres `/api/arbitrage` válasz kulcsa (drótforma; olvasáskor `reviveArbitrageSnapshot`). */
export const ARBITRAGE_CACHE_KEY = 'oe_cache_arbitrage';

/** Meccsenkénti cache-kulcs a meccs-részlethez (`/api/fixtures/:id` + `/api/odds/:id/history`). */
export const matchCacheKey = (fixtureId: number): string => `oe_cache_match_${fixtureId}`;

/** Az utolsó sikeres `/api/evaluation?model=` válasz kulcsa, modellverziónként (üres = minden verzió). */
export const evaluationCacheKey = (model: string): string => (model ? `oe_cache_evaluation_${model}` : 'oe_cache_evaluation');

/** Az utolsó sikeres `/api/budget` válasz kulcsa (I21). */
export const BUDGET_CACHE_KEY = 'oe_cache_budget';
