// Bump version whenever sw.js changes
const CACHE_NAME = 'klasskit-v1.7.3';

// 1. Pre-cache Core Assets (Static)
// Note: Use clean paths or keep consistent with how your app navigates
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './hub',
  './login.html',
  './404.html',
  './admin/index.html',
  './admin/style.css',
  './admin/js/core.js',
  './admin/js/stats.js',
  './admin/js/users.js',
  './admin/js/audit.js',
  './admin/js/settings.js',
  './admin/js/cloud.js',
  './js/hub/core.js',
  './js/hub/ui.js',
  './js/hub/views.js',
  './js/hub/workspace.js',
  './js/hub/timer.js',
  './js/hub/app.js',
  './supabase.js',
  './games.json',
  './manifest.json',
  './components/app-bootstrap.js',
  './components/input-modal.js',
  './components/bulk-import-modal.js',
  './components/media-manager.js',
  './css/tailwind.generated.css',
  './css/base.css',
  './css/components.css',
  './css/home.css',
  './css/side-panel.css',
  './media/icon.png',
  './media/icon-180.png',
  './media/icon-192.png',
  './media/icon-512.png',
  './media/icon.ico',
  './media/icon.webp',
  './media/card_match_preview.webp',
  './media/classtally_preview.webp',
  './media/connect_four_preview.webp',
  './media/hangman_preview.webp',
  './media/magic_cups_preview.webp',
  './media/presentation_preview.webp',
  './media/quiz_preview.webp',
  './media/spinwheel_preview.webp',
  './media/teampicker_preview.webp',
  './media/whiteboard_preview.webp',
  './media/word_search_preview.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRE_CACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((cache) => cache !== CACHE_NAME)
          .map((cache) => caches.delete(cache))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;
  if (url.hostname.includes('supabase.co')) return;
  if (url.hostname.includes('cloudflareinsights.com')) return;

  // Navigation requests (HTML pages): Network-First so Cloudflare redirects & fresh HTML work cleanly
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_NAME);
          return (
            (await cache.match(request)) ||
            (await cache.match('./hub')) ||
            (await cache.match('./index.html')) ||
            (await cache.match('./404.html')) ||
            new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
          );
        })
    );
    return;
  }

  // Static assets (JS, CSS, JSON, images): Stale-While-Revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);

      return cachedResponse || (await fetchPromise) || new Response('', { status: 504 });
    })
  );
});
