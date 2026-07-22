const CACHE_NAME = 'rentora-v2';
const STATIC_ASSETS = ['/', '/browse', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Only handle http/https — skip chrome-extension, blob, data, etc.
  if (!event.request.url.startsWith('http')) return;

  // Only cache same-origin requests — skip ALL external domains
  if (url.origin !== self.location.origin) return;

  // Skip non-GET
  if (event.request.method !== 'GET') return;

  // Skip Supabase API calls
  if (url.pathname.includes('/rest/v1/') || url.pathname.includes('/auth/')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful same-origin responses
        if (response.ok && response.status === 200) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            try {
              cache.put(event.request, responseToCache);
            } catch (e) {
              // Silently ignore cache errors (e.g. chrome-extension scheme)
            }
          });
        }
        return response;
      })
      .catch(() => {
        // Offline fallback — serve cached version or home page
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
          // Previously fell through here and resolved to `undefined`,
          // which event.respondWith() cannot use — that's what threw
          // "Failed to convert value to 'Response'" for any uncached,
          // non-document request (e.g. a blocked/failed asset fetch).
          return new Response('', { status: 504, statusText: 'Offline and not cached' });
        });
      })
  );
});