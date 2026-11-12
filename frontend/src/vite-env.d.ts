/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_RAPIDAPI_KEY?: string;
	readonly VITE_APISPORTS_KEY?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
