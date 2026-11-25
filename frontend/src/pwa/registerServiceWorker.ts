/** A service worker regisztrálása – csak prod-buildben (dev alatt a Vite HMR-rel ütközne). */
export function registerServiceWorker(): void {
	if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	window.addEventListener('load', () => {
		navigator.serviceWorker
			.register('/sw.js')
			.then((reg) => {
				document.documentElement.dataset.sw = 'registered';
				console.info('[sw] registered, scope:', reg.scope);
			})
			.catch((err) => {
				document.documentElement.dataset.sw = 'failed';
				console.warn('[sw] registration failed:', err);
			});
	});
}
