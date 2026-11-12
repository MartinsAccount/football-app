// @football/core — tiszta domain-logika (nincs I/O): a web app és a (későbbi) API közösen használja.
export * from './odds/types';
export * from './constants/betTypes';
export * from './arbitrage/types';
export * from './arbitrage/analyzeBookmakers';
export * from './odds/value';
export * from './model/market';
export * from './format/format';
export * from './slip/slip';
