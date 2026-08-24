/* eslint-disable no-restricted-globals */
// eslint-disable-next-line no-unused-vars
const ignored = self.__WB_MANIFEST;
const CACHE_NAME = 's2t-cache-v5';
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
  // Only ever handle our own GETs. Intercepting cross-origin requests broke
  // media loads (the ringtone CDN, ranged audio) and API calls: fetch() would
  // reject and the cache miss below resolved to undefined, which respondWith
  // cannot accept — "Failed to convert value to 'Response'".
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Network first, fall back to cache — but never resolve with undefined.
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
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        // A navigation asks for the APP, not for a file. Every route is served
        // by the same index.html, so matching on the request URL finds nothing
        // for /practice, /live, /profile — only "/" was ever precached — and
        // the learner got an empty 504 body, which is a white screen. Falling
        // back to the shell lets the router take the path from there.
        if (event.request.mode === 'navigate') {
          const shell = (await caches.match('/index.html')) || (await caches.match('/'));
          if (shell) return shell;
        }
        return new Response('', { status: 504, statusText: 'Offline' });
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
