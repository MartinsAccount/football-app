import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ArbitrageResponse, BacktestResponse, RecommendationsResponse } from '@football/contract';

/**
 * A pillanatkép-végpontok (SB4) forrása. Ma a generátor-scriptek mentett JSON-jai (`data/*\/*-v0.json`), később DB-tábla –
 * a router csak ezt az interfészt látja. `null` = még nincs pillanatkép (→ 404).
 */
export interface SnapshotSource {
	recommendations(): Promise<RecommendationsResponse | null>;
	backtest(): Promise<BacktestResponse | null>;
	arbitrage(): Promise<ArbitrageResponse | null>;
}

/** A pillanatképek helye a `dataDir` (a repó `data/` mappája) alatt. */
export const SNAPSHOT_FILES = {
	recommendations: join('recommendations', 'recommendations-v0.json'),
	backtest: join('backtest', 'backtest-v0.json'),
	arbitrage: join('arbitrage', 'arbitrage-v0.json')
} as const;

async function readJson<T>(path: string): Promise<T | null> {
	try {
		return JSON.parse(await readFile(path, 'utf8')) as T;
	} catch (e) {
		if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
		throw e;
	}
}

/** Fájl-alapú forrás (Node). Kérésenként olvas, így egy újragenerált pillanatkép újraindítás nélkül látszik. */
export function fileSnapshotSource(dataDir: string): SnapshotSource {
	return {
		recommendations: () => readJson<RecommendationsResponse>(join(dataDir, SNAPSHOT_FILES.recommendations)),
		backtest: () => readJson<BacktestResponse>(join(dataDir, SNAPSHOT_FILES.backtest)),
		arbitrage: () => readJson<ArbitrageResponse>(join(dataDir, SNAPSHOT_FILES.arbitrage))
	};
}
