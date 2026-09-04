// Pushes every URL in sitemap.xml to IndexNow (api.indexnow.org) so Bing --
// and any other participating engine, since it's a shared protocol, not a
// Bing-only one -- picks up new/changed pages immediately instead of
// waiting on its own crawl schedule or someone remembering to hit
// "Submit" on the sitemap by hand.
//
// The key is self-issued, not something Bing generates for you -- it's
// just a random string proven to belong to this domain by hosting a file
// named <key>.txt containing it at the site root (see build.js's
// staticFiles list). Submitting the same unchanged URLs repeatedly is
// explicitly fine per the protocol; search engines dedupe on their side,
// so no diffing against the last run is needed here.
//
// Usage: node scripts/indexnow-ping.js
// Wired into CI (.github/workflows/build.yml) to run automatically after
// every successful push to main.

const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = '7d651288514fb3e2d4dbc8ae19450700';
const HOST = 'toolsharp.dev';
const REPO = path.join(__dirname, '..');

function getSitemapUrls() {
  const sitemap = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
}

function postJson(hostname, pathname, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request({
      hostname,
      path: pathname,
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data) },
    }, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: chunks }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const urlList = getSitemapUrls();
  if (!urlList.length) {
    console.error('No URLs found in sitemap.xml -- nothing to submit.');
    process.exit(1);
  }

  const payload = {
    host: HOST,
    key: KEY,
    keyLocation: `https://${HOST}/${KEY}.txt`,
    urlList,
  };

  try {
    const { status, body } = await postJson('api.indexnow.org', '/indexnow', payload);
    // IndexNow returns 200 (submitted) or 202 (accepted, key not yet
    // verified live -- normal on the very first run before a deploy has
    // actually published the key file) for success; anything else is real.
    if (status === 200 || status === 202) {
      console.log(`IndexNow: submitted ${urlList.length} URLs (HTTP ${status})`);
    } else {
      console.error(`IndexNow: unexpected response HTTP ${status} -- ${body.slice(0, 300)}`);
      process.exit(1);
    }
  } catch (err) {
    console.error('IndexNow: request failed --', err.message);
    process.exit(1);
  }
}

main();
