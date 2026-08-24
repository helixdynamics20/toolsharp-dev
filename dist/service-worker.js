const CACHE_NAME = 'toolsharp-cache-v2';
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
  '/tools/url-encoder.html',
  '/tools/sql-formatter.html',
  '/tools/password-generator.html',
  '/tools/case-converter.html',
  '/tools/xml-formatter.html',
  '/tools/base-converter.html',
  '/tools/csv-json-converter.html',
  '/tools/color-converter.html',
  '/tools/markdown-previewer.html',
  '/tools/qr-code-generator.html',
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
  '/js/epoch-converter.js',
  '/js/url-encoder.js',
  '/js/sql-formatter.js',
  '/js/password-generator.js',
  '/js/case-converter.js',
  '/js/xml-formatter.js',
  '/js/base-converter.js',
  '/js/csv-json-converter.js',
  '/js/color-converter.js',
  '/js/markdown-previewer.js',
  '/js/qr-code-generator.js',
  '/js/qrcode.bundle.js',
  '/js/marked.bundle.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

// Network-first: always try the network, fall back to cache only when offline
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    fetch(event.request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseToCache));
      return response;
    }).catch(() => {
      return caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/404.html');
        }
      });
    })
  );
});
