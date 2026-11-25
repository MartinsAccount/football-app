// Adatforrás-kapcsoló (ROADMAP 0.5): 'fixture' = mentett API-válaszokból dolgozunk, 0 élő hívás;
// 'live' = valódi API-Football hívás. Alapértelmezés: fixture — élő hívás csak kifejezett VITE_DATA_MODE=live mellett.
export type DataMode = 'fixture' | 'live';

export const getDataMode = (): DataMode => (import.meta.env.VITE_DATA_MODE === 'live' ? 'live' : 'fixture');

export const isFixtureMode = (): boolean => getDataMode() === 'fixture';
