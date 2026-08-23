const CACHE_NAME = 'toolsharp-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/404.html',
  '/css/style.css',
  '/js/theme.js',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/tools/connection-string-builder.html',
  '/tools/cron-builder.html',
  '/tools/jwt-decoder.html',
  '/tools/guid-formatter.html',
  '/tools/regex-tester.html',
  '/tools/appsettings-validator.html',
  '/tools/json-formatter.html',
  '/tools/diff-checker.html',
  '/tools/base64-converter.html',
  '/tools/share-pad.html',
  '/tools/hash-generator.html',
  '/tools/epoch-converter.html',
  '/js/connection-string-builder.js',
  '/js/cron-builder.js',
  '/js/jwt-decoder.js',
  '/js/guid-formatter.js',
  '/js/regex-tester.js',
  '/js/appsettings-validator.js',
  '/js/json-formatter.js',
  '/js/diff-checker.js',
  '/js/base64-converter.js',
  '/js/share-pad.js',
  '/js/hash-generator.js',
  '/js/epoch-converter.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        if (event.request.headers.get('accept').includes('text/html')) {
          return caches.match('/404.html');
        }
      });
    })
  );
});
