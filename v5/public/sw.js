const CACHE_PREFIX = 'biotrack-v5-';
const BUILD_ID = '__BIOTRACK_BUILD_ID__';
const APP_CACHE = `${CACHE_PREFIX}app-${BUILD_ID}`;
const RUNTIME_CACHE = `${CACHE_PREFIX}runtime-${BUILD_ID}`;
const ACTIVE_CACHES = new Set([APP_CACHE, RUNTIME_CACHE]);
const APP_SHELL = ['/', '/manifest.json', '/biotrack-icon.svg', '/apple-touch-icon.png'];

async function cacheAppShell() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_SHELL.map((path) => new Request(path, { cache: 'reload' })));
}

async function deleteOldCaches() {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CACHE_PREFIX) && !ACTIVE_CACHES.has(key))
      .map((key) => caches.delete(key)),
  );
}

async function networkFirst(request, cacheName, fallbackKey = request) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(new Request(request, { cache: 'no-store' }));
    if (response.ok) await cache.put(fallbackKey, response.clone());
    return response;
  } catch {
    return (await cache.match(fallbackKey)) ?? (await caches.match(fallbackKey)) ?? Response.error();
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    deleteOldCaches()
      .then(() => self.clients.claim())
      .then(async () => {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        clients.forEach((client) => client.postMessage({ type: 'PWA_VERSION_ACTIVATED', buildId: BUILD_ID }));
      }),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
    return;
  }

  if (event.data?.type === 'GET_VERSION') {
    event.ports?.[0]?.postMessage({ buildId: BUILD_ID });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, APP_CACHE, '/'));
    return;
  }

  if (url.pathname === '/manifest.json') {
    event.respondWith(networkFirst(request, APP_CACHE));
    return;
  }

  const destination = request.destination;
  const isVersionSensitiveAsset = destination === 'script' || destination === 'style' || destination === 'worker';
  if (isVersionSensitiveAsset) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE));
    return;
  }

  const isReusableAsset = destination === 'image' || destination === 'font';
  if (!isReusableAsset) return;

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const refresh = fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cachedResponse ?? Response.error());

      return cachedResponse ?? refresh;
    }),
  );
});
