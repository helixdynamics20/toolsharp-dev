// Serves dist/ the same way Vercel actually does in production -- clean
// URLs (/tools/foo) resolved via the exact rewrite rules in vercel.json,
// not the .html files directly.
//
// Every E2E script in this project before this file existed tested
// /tools/foo.html against a plain static-file server, which isn't the URL
// shape a real visitor or Googlebot ever requests -- clean-URL-specific
// bugs (a bad rewrite, a broken redirect) were structurally untestable.
// This mirrors vercel.json's `rewrites` array directly rather than
// reimplementing routing logic that has to be kept in sync by hand.

const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
};

// Mirrors vercel.json's "rewrites" array exactly -- resolves a clean URL to
// the real file on disk. Falls through unchanged for anything not covered
// (static assets, files that already carry their own extension).
function resolveRewrite(urlPath) {
  if (urlPath === '/guides') return '/guides/index.html';
  if (urlPath === '/tools') return '/tools/index.html';
  if (urlPath === '/privacy-policy') return '/privacy-policy.html';
  if (urlPath === '/terms') return '/terms.html';
  if (urlPath === '/contact') return '/contact.html';
  let m = urlPath.match(/^\/tools\/([^/]+)$/);
  if (m) return `/tools/${m[1]}.html`;
  m = urlPath.match(/^\/guides\/([^/]+)$/);
  if (m) return `/guides/${m[1]}.html`;
  if (urlPath === '/') return '/index.html';
  return urlPath;
}

// Mirrors vercel.json's "redirects" array -- old .html URLs 301/308 to the
// clean equivalent. Real visitors rarely hit these directly, but the site's
// own sitemap/crawl-stats history did (see the launch-week GSC crawl log),
// so a broken redirect here is a real, previously-real-world-hit bug class.
function resolveRedirect(urlPath) {
  if (urlPath === '/index.html') return '/';
  if (urlPath === '/guides/index.html') return '/guides';
  if (urlPath === '/tools/index.html') return '/tools';
  let m = urlPath.match(/^\/tools\/([^/]+)\.html$/);
  if (m) return `/tools/${m[1]}`;
  m = urlPath.match(/^\/guides\/([^/]+)\.html$/);
  if (m) return `/guides/${m[1]}`;
  if (urlPath === '/privacy-policy.html') return '/privacy-policy';
  if (urlPath === '/terms.html') return '/terms';
  if (urlPath === '/contact.html') return '/contact';
  return null;
}

function startServer(port) {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    const redirectTo = resolveRedirect(urlPath);
    if (redirectTo) {
      res.writeHead(308, { Location: redirectTo });
      res.end();
      return;
    }

    const filePath = path.join(DIST, resolveRewrite(urlPath));
    fs.readFile(filePath, (err, data) => {
      if (err) {
        const notFoundPath = path.join(DIST, '404.html');
        fs.readFile(notFoundPath, (err2, data2) => {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(err2 ? 'Not found' : data2);
        });
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(port, () => resolve(server));
  });
}

module.exports = { startServer, DIST };

if (require.main === module) {
  const port = Number(process.argv[2]) || 8099;
  startServer(port).then(() => console.log(`Serving dist/ at http://localhost:${port} (vercel.json rewrites applied)`));
}
