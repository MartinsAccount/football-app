/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_RAPIDAPI_KEY?: string;
	readonly VITE_APISPORTS_KEY?: string;
	/** 'fixture' (alap) | 'live' — lásd src/services/dataMode.ts */
	readonly VITE_DATA_MODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
