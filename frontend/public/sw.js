/* Odds elemző – kézi service worker (ADR-0010, docs/plans/mobile.md M1). Külső függőség nincs.
 * A buildben a vite.config.ts `pwaPrecache` pluginja kitölti a __BUILD_ID__ és __PRECACHE__ helyőrzőket. */
'use strict';

var BUILD_ID = '__BUILD_ID__';
var PRECACHE = /*__PRECACHE__*/ ['/', '/index.html', '/manifest.json'];
var CACHE_PREFIX = 'oe-';
var SHELL_CACHE = CACHE_PREFIX + 'shell-' + BUILD_ID;
var DATA_CACHE = CACHE_PREFIX + 'data-' + BUILD_ID;

// A szabály másolata: src/pwa/cacheStrategy.ts (a teszt szó szerint összeveti).
// SW-SHARED-START
function pickStrategy(req, origin) {
	if (req.method !== 'GET') return 'network-only';
	var u = new URL(req.url, origin);
	if (u.origin !== origin) return 'network-only';
	var p = u.pathname;
	if (p === '/sw.js') return 'network-only';
	if (p.indexOf('/api/') === 0) return 'network-first';
	if (req.mode === 'navigate') return 'navigate';
	if (/\.json$/i.test(p)) return 'network-first';
	return 'cache-first';
}
// SW-SHARED-END

self.addEventListener('install', function (event) {
	event.waitUntil(
		caches
			.open(SHELL_CACHE)
			.then(function (cache) {
				return cache.addAll(PRECACHE);
			})
			.then(function () {
				return self.skipWaiting();
			})
	);
});

self.addEventListener('activate', function (event) {
	event.waitUntil(
		caches
			.keys()
			.then(function (keys) {
				return Promise.all(
					keys
						.filter(function (k) {
							return k.indexOf(CACHE_PREFIX) === 0 && k !== SHELL_CACHE && k !== DATA_CACHE;
						})
						.map(function (k) {
							return caches.delete(k);
						})
				);
			})
			.then(function () {
				return self.clients.claim();
			})
	);
});

function networkFirst(request, cacheName, fallbackUrl) {
	return fetch(request)
		.then(function (res) {
			if (res && res.ok) {
				var copy = res.clone();
				caches.open(cacheName).then(function (c) {
					c.put(request, copy);
				});
			}
			return res;
		})
		.catch(function () {
			return caches.match(request).then(function (hit) {
				if (hit) return hit;
				if (fallbackUrl) return caches.match(fallbackUrl);
				return Response.error();
			});
		});
}

function cacheFirst(request) {
	return caches.match(request).then(function (hit) {
		if (hit) return hit;
		return fetch(request).then(function (res) {
			if (res && res.ok && res.type === 'basic') {
				var copy = res.clone();
				caches.open(SHELL_CACHE).then(function (c) {
					c.put(request, copy);
				});
			}
			return res;
		});
	});
}

self.addEventListener('fetch', function (event) {
	var req = event.request;
	var strategy = pickStrategy({ method: req.method, url: req.url, mode: req.mode }, self.location.origin);
	if (strategy === 'network-only') return;
	if (strategy === 'network-first') event.respondWith(networkFirst(req, DATA_CACHE));
	else if (strategy === 'navigate') event.respondWith(networkFirst(req, SHELL_CACHE, '/index.html'));
	else event.respondWith(cacheFirst(req));
});
