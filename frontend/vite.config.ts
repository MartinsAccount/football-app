/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: http://localhost:3000, a /api hívások a backendhez (Express, :5000) mennek.
export default defineConfig({
	// A MobX v5 legacy dekorátorai (@observable, @inject, @observer): dev módban a plugin-react
	// Babellel parse-ol (Fast Refresh), ezért kell a 'decorators-legacy' szintaxis; az átalakítást
	// az esbuild végzi a tsconfig experimentalDecorators + useDefineForClassFields:false alapján.
	plugins: [react({ babel: { parserOpts: { plugins: ['decorators-legacy'] } } })],
	server: {
		port: 3000,
		strictPort: true,
		proxy: { '/api': 'http://localhost:5000' }
	},
	build: { outDir: 'build' },
	test: {
		globals: true,
		environment: 'node',
		include: ['src/**/*.test.{ts,tsx}'],
		passWithNoTests: true
	}
});
