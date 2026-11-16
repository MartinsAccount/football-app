/// <reference types="vite/client" />

interface ImportMetaEnv {
	/** 'fixture' (alap) | 'live' — lásd src/services/dataMode.ts */
	readonly VITE_DATA_MODE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
