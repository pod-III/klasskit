// Be sure to bump this version number whenever you change this file
// so the browser knows to run the 'install' and 'activate' steps again.
const CACHE_NAME = 'klasskit-v1.4.2';

// 1. Pre-cache Core Assets (Static)
const PRE_CACHE_ASSETS = [
  './',
  './index.html',
  './hub.html',
  './admin/index.html',
  './admin/style.css',
  './admin/script.js',
  './script.js',
  './games.json',
  './manifest.json',
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
  // Optimized Previews (webp)
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

// Install Event - Pre-cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core assets');
      return cache.addAll(PRE_CACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Ignore non-GET and non-HTTP requests
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) return;

  // 2. Strategy: Network-Only for Supabase/API calls
  // We don't want to cache database responses here as they are handled by the app's sync logic.
  if (url.hostname.includes('supabase.co')) return;

  // 3. Strategy: Stale-While-Revalidate for all other assets
  // This gives the fastest load time while keeping assets fresh in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          // If network call succeeds, update cache
          if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // If network fails completely, we already returned cachedResponse
        });

        // Return cached if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      });
    })
  );
});