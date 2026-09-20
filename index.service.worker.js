// This service worker is required to expose an exported Godot project as a
// Progressive Web App. It provides an offline fallback page telling the user
// that they need an Internet connection to run the project if desired.
// Incrementing CACHE_VERSION will kick off the install event and force
// previously cached resources to be updated from the network.
/** @type {string} */
const CACHE_VERSION = '1789895057|1989702';
/** @type {string} */
const CACHE_PREFIX = 'Defenda Valen-sw-cache-';
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
/** @type {string} */
const OFFLINE_URL = 'index.offline.html';
/** @type {boolean} */
const ENSURE_CROSSORIGIN_ISOLATION_HEADERS = true;
// Files that will be cached on load.
/** @type {string[]} */
const CACHED_FILES = ["index.html","index.js","index.offline.html","index.icon.png","index.apple-touch-icon.png","index.audio.worklet.js","index.audio.position.worklet.js","local/protocol/classes.js","local/protocol/client-messages.js","local/protocol/company.js","local/protocol/constants.js","local/protocol/index.js","local/protocol/server-messages.js","local/protocol/snapshot-wire.js","local/protocol/upgrades.js","local/qr/decode.js","local/qr/encode.js","local/servidor/browser/offline-host.js","local/servidor/browser/peer-link.js","local/servidor/browser/qr-bridge.js","local/servidor/config/logger.js","local/servidor/domain/combatant.js","local/servidor/domain/companion.js","local/servidor/domain/enemy.js","local/servidor/domain/gate.js","local/servidor/domain/ids.js","local/servidor/domain/player.js","local/servidor/domain/room.js","local/servidor/domain/structure.js","local/servidor/domain/vector.js","local/servidor/network/connection.js","local/servidor/network/message-handler.js","local/servidor/network/rate-limiter.js","local/servidor/rooms/room-manager.js","local/servidor/simulation/ability.js","local/servidor/simulation/banner.js","local/servidor/simulation/collision.js","local/servidor/simulation/combat.js","local/servidor/simulation/companion-ai.js","local/servidor/simulation/director.js","local/servidor/simulation/enemy-ai.js","local/servidor/simulation/loop.js","local/servidor/simulation/match-end.js","local/servidor/simulation/movement.js","local/servidor/simulation/progression.js","local/servidor/simulation/projectile.js","local/servidor/simulation/regen.js","local/servidor/simulation/revive.js","local/servidor/simulation/separation.js","local/servidor/simulation/siege.js","local/servidor/simulation/special.js","local/servidor/simulation/zone.js","local/zod/index.js","local/zod/v4/classic/checks.js","local/zod/v4/classic/coerce.js","local/zod/v4/classic/compat.js","local/zod/v4/classic/deep-partial.js","local/zod/v4/classic/errors.js","local/zod/v4/classic/external.js","local/zod/v4/classic/from-json-schema.js","local/zod/v4/classic/in-out.js","local/zod/v4/classic/iso.js","local/zod/v4/classic/parse.js","local/zod/v4/classic/schemas.js","local/zod/v4/core/api.js","local/zod/v4/core/checks.js","local/zod/v4/core/compile.js","local/zod/v4/core/core.js","local/zod/v4/core/doc.js","local/zod/v4/core/errors.js","local/zod/v4/core/index.js","local/zod/v4/core/json-schema-generator.js","local/zod/v4/core/json-schema-processors.js","local/zod/v4/core/json-schema.js","local/zod/v4/core/memoizer.js","local/zod/v4/core/parse.js","local/zod/v4/core/regexes.js","local/zod/v4/core/registries.js","local/zod/v4/core/schemas.js","local/zod/v4/core/to-json-schema.js","local/zod/v4/core/util.js","local/zod/v4/core/versions.js","local/zod/v4/core/visit.js","local/zod/v4/locales/ar.js","local/zod/v4/locales/az.js","local/zod/v4/locales/be.js","local/zod/v4/locales/bg.js","local/zod/v4/locales/bn.js","local/zod/v4/locales/ca.js","local/zod/v4/locales/ckb.js","local/zod/v4/locales/cs.js","local/zod/v4/locales/da.js","local/zod/v4/locales/de.js","local/zod/v4/locales/el.js","local/zod/v4/locales/en.js","local/zod/v4/locales/eo.js","local/zod/v4/locales/es.js","local/zod/v4/locales/fa.js","local/zod/v4/locales/fi.js","local/zod/v4/locales/fr-CA.js","local/zod/v4/locales/fr.js","local/zod/v4/locales/gu.js","local/zod/v4/locales/he.js","local/zod/v4/locales/hi.js","local/zod/v4/locales/hr.js","local/zod/v4/locales/hu.js","local/zod/v4/locales/hy.js","local/zod/v4/locales/id.js","local/zod/v4/locales/index.js","local/zod/v4/locales/is.js","local/zod/v4/locales/it.js","local/zod/v4/locales/ja.js","local/zod/v4/locales/ka.js","local/zod/v4/locales/kh.js","local/zod/v4/locales/km.js","local/zod/v4/locales/kn.js","local/zod/v4/locales/ko.js","local/zod/v4/locales/lt.js","local/zod/v4/locales/mk.js","local/zod/v4/locales/ms.js","local/zod/v4/locales/ne.js","local/zod/v4/locales/nl.js","local/zod/v4/locales/nn.js","local/zod/v4/locales/no.js","local/zod/v4/locales/ota.js","local/zod/v4/locales/pl.js","local/zod/v4/locales/ps.js","local/zod/v4/locales/pt-BR.js","local/zod/v4/locales/pt.js","local/zod/v4/locales/ro.js","local/zod/v4/locales/ru.js","local/zod/v4/locales/sk.js","local/zod/v4/locales/sl.js","local/zod/v4/locales/sv.js","local/zod/v4/locales/ta.js","local/zod/v4/locales/tg.js","local/zod/v4/locales/th.js","local/zod/v4/locales/tk.js","local/zod/v4/locales/tr.js","local/zod/v4/locales/ua.js","local/zod/v4/locales/uk.js","local/zod/v4/locales/ur.js","local/zod/v4/locales/uz.js","local/zod/v4/locales/vi.js","local/zod/v4/locales/yo.js","local/zod/v4/locales/zh-CN.js","local/zod/v4/locales/zh-TW.js","index.wasm","index.pck","index.service.worker.js","index.manifest.json","index.144x144.png","index.180x180.png","index.512x512.png"];
// Files that we might not want the user to preload, and will only be cached on first load.
/** @type {string[]} */
const CACHEABLE_FILES = ["index.wasm","index.pck"];
const FULL_CACHE = CACHED_FILES.concat(CACHEABLE_FILES);

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHED_FILES)));
});

self.addEventListener('activate', (event) => {
	event.waitUntil(caches.keys().then(
		function (keys) {
			// Remove old caches.
			return Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map((key) => caches.delete(key)));
		}
	).then(function () {
		// Enable navigation preload if available.
		return ('navigationPreload' in self.registration) ? self.registration.navigationPreload.enable() : Promise.resolve();
	}));
});

/**
 * Ensures that the response has the correct COEP/COOP headers
 * @param {Response} response
 * @returns {Response}
 */
function ensureCrossOriginIsolationHeaders(response) {
	if (response.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp'
		&& response.headers.get('Cross-Origin-Opener-Policy') === 'same-origin') {
		return response;
	}

	const crossOriginIsolatedHeaders = new Headers(response.headers);
	crossOriginIsolatedHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
	crossOriginIsolatedHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
	const newResponse = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: crossOriginIsolatedHeaders,
	});

	return newResponse;
}

/**
 * Calls fetch and cache the result if it is cacheable
 * @param {FetchEvent} event
 * @param {Cache} cache
 * @param {boolean} isCacheable
 * @returns {Response}
 */
async function fetchAndCache(event, cache, isCacheable) {
	// Use the preloaded response, if it's there
	/** @type { Response } */
	let response = await event.preloadResponse;
	if (response == null) {
		// Or, go over network.
		response = await self.fetch(event.request);
	}

	if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
		response = ensureCrossOriginIsolationHeaders(response);
	}

	if (isCacheable) {
		// And update the cache
		cache.put(event.request, response.clone());
	}

	return response;
}

self.addEventListener(
	'fetch',
	/**
	 * Triggered on fetch
	 * @param {FetchEvent} event
	 */
	(event) => {
		const isNavigate = event.request.mode === 'navigate';
		const url = event.request.url || '';
		const referrer = event.request.referrer || '';
		const base = referrer.slice(0, referrer.lastIndexOf('/') + 1);
		const scope = self.registration.scope;
		const local = url.startsWith(scope) ? url.slice(scope.length) : '';
		const isCacheable = FULL_CACHE.some((v) => v === local) || (base === referrer && base.endsWith(CACHED_FILES[0]));
		if (isNavigate || isCacheable) {
			event.respondWith((async () => {
				// Try to use cache first
				const cache = await caches.open(CACHE_NAME);
				if (isNavigate) {
					// Check if we have full cache during HTML page request.
					/** @type {Response[]} */
					const fullCache = await Promise.all(FULL_CACHE.map((name) => cache.match(name)));
					const missing = fullCache.some((v) => v === undefined);
					if (missing) {
						try {
							// Try network if some cached file is missing (so we can display offline page in case).
							const response = await fetchAndCache(event, cache, isCacheable);
							return response;
						} catch (e) {
							// And return the hopefully always cached offline page in case of network failure.
							console.error('Network error: ', e); // eslint-disable-line no-console
							return caches.match(OFFLINE_URL);
						}
					}
				}
				let cached = await cache.match(isNavigate ? 'index.html' : event.request);
				if (cached != null) {
					if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
						cached = ensureCrossOriginIsolationHeaders(cached);
					}
					return cached;
				}
				// Try network if don't have it in cache.
				const response = await fetchAndCache(event, cache, isCacheable);
				return response;
			})());
		} else if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
			event.respondWith((async () => {
				let response = await fetch(event.request);
				response = ensureCrossOriginIsolationHeaders(response);
				return response;
			})());
		}
	}
);

self.addEventListener('message', (event) => {
	// No cross origin
	if (event.origin !== self.origin) {
		return;
	}
	const id = event.source.id || '';
	const msg = event.data || '';
	// Ensure it's one of our clients.
	self.clients.get(id).then(function (client) {
		if (!client) {
			return; // Not a valid client.
		}
		if (msg === 'claim') {
			self.skipWaiting().then(() => self.clients.claim());
		} else if (msg === 'clear') {
			caches.delete(CACHE_NAME);
		} else if (msg === 'update') {
			self.skipWaiting().then(() => self.clients.claim()).then(() => self.clients.matchAll()).then((all) => all.forEach((c) => c.navigate(c.url)));
		}
	});
});

