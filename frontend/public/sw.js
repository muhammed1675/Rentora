const CACHE_NAME = 'rentora-v1';
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
  // Skip non-GET, Supabase, PostHog, external API calls — never cache those
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('supabase.co') ||
    event.request.url.includes('posthog.com') ||
    event.request.url.includes('korapay.com') ||
    event.request.url.includes('emergent.sh') ||
    event.request.url.includes('/rest/v1/') ||
    event.request.url.includes('/auth/')
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache valid responses for HTML/JS/CSS/images
        if (
          response.ok &&
          response.status === 200 &&
          (event.request.destination === 'document' ||
            event.request.destination === 'script' ||
            event.request.destination === 'style' ||
            event.request.destination === 'image')
        ) {
          // Clone BEFORE reading — fixes "body already used" error
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.destination === 'document') {
            return caches.match('/');
          }
        });
      })
  );
});
