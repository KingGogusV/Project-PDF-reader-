/* Build replaces the version and allowlist. Do not register this template in development. */
const VERSION = '__FOLIO_SW_VERSION__';
const ASSET_PATHS = /*__FOLIO_ASSET_MANIFEST__*/ [];
const CACHE_PREFIX = 'folio-app-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const scope = new URL('./', self.location.href);
const assetUrls = new Set(ASSET_PATHS.map(path => new URL(path, scope).href));
const shellUrl = new URL('index.html', scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    if (!ASSET_PATHS.length) throw new Error('The offline asset manifest has not been generated.');
    const cache = await caches.open(CACHE_NAME);
    // Only build-generated local application assets are cached. User PDFs are never eligible.
    await cache.addAll(Array.from(assetUrls));
    // Do not force activation: updating while documents are open can mix application versions.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Do not cache uploads, external requests, Blob URLs, query URLs, or arbitrary documents.
  if (request.method !== 'GET' || url.origin !== scope.origin || url.search || url.protocol === 'blob:') return;
  if (request.mode === 'navigate' && (url.pathname === scope.pathname || request.url === shellUrl)) {
    event.respondWith((async () => {
      // Keep shell and stable vendor URLs on the same active version. A newer
      // worker waits for old documents to close before activating its complete cache.
      const shell = await caches.match(shellUrl, { cacheName: CACHE_NAME });
      if (shell) return shell;
      return fetch(request);
    })());
    return;
  }
  if (!assetUrls.has(request.url)) return;
  event.respondWith((async () => {
    const cached = await caches.match(request, { cacheName: CACHE_NAME });
    return cached || fetch(request);
  })());
});
