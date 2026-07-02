/* eslint-disable no-restricted-globals */
// eslint-disable-next-line no-unused-vars
const ignored = self.__WB_MANIFEST;
const CACHE_NAME = 's2t-cache-v3';
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/logo.svg'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Don't intercept POST requests or external API calls
  if (
    event.request.method !== 'GET' ||
    event.request.url.includes('firestore.googleapis.com') || 
    event.request.url.includes('identitytoolkit') ||
    event.request.url.includes('api.openai.com') ||
    event.request.url.includes('api.deepseek.com')
  ) {
    return;
  }

  // Network First, fallback to cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
          return null;
        })
      );
    })
  );
});
