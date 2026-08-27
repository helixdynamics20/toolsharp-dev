const CACHE_NAME = 'toolsharp-cache-v4';
const ASSETS = [
  '/',
  '/404.html',
  '/css/style.css',
  '/js/theme.js',
  '/js/utils.js',
  '/js/analytics.bundle.js',
  '/js/speed-insights.js',
  '/favicon.svg',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.json',
  '/assets/icons/icon-192.png',
  '/assets/icons/icon-512.png',
  '/tools/connection-string-builder',
  '/tools/cron-builder',
  '/tools/jwt-decoder',
  '/tools/guid-formatter',
  '/tools/regex-tester',
  '/tools/appsettings-validator',
  '/tools/json-formatter',
  '/tools/diff-checker',
  '/tools/base64-converter',
  '/tools/share-pad',
  '/tools/hash-generator',
  '/tools/epoch-converter',
  '/tools/url-encoder',
  '/tools/sql-formatter',
  '/tools/password-generator',
  '/tools/case-converter',
  '/tools/xml-formatter',
  '/tools/base-converter',
  '/tools/csv-json-converter',
  '/tools/color-converter',
  '/tools/markdown-previewer',
  '/tools/qr-code-generator',
  '/guides',
  '/guides/cron-expression-cheat-sheet',
  '/guides/what-is-a-jwt',
  '/guides/sql-server-connection-string-examples',
  '/guides/regex-cheat-sheet',
  '/guides/hashing-algorithms-explained',
  '/guides/uuid-guid-versions-explained',
  '/guides/unix-timestamp-epoch-explained',
  '/js/connection-string-builder.js',
  '/js/cron-builder.js',
  '/js/jwt-decoder.js',
  '/js/guid-formatter.js',
  '/js/regex-tester.js',
  '/js/regex-tester-worker.js',
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
