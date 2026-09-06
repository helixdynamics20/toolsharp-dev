// Checks every internal <a href> across the whole site actually resolves,
// using the real clean-URL server (serve.js) -- standard URL resolution
// works correctly here specifically because that server implements
// vercel.json's rewrites for real, unlike a plain static-file server.

const { chromium } = require('playwright');

async function run(BASE) {
  const listPageUrls = require('./_pages');
  const pages = listPageUrls();

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const linkSources = new Map(); // resolved href (no hash) -> Set of source pages
  const externalLinks = new Map();
  const anchorIdsByPage = new Map();

  for (const u of pages) {
    await page.goto(BASE + u, { waitUntil: 'load' });
    const { links, ids } = await page.evaluate(() => ({
      links: [...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')),
      ids: [...document.querySelectorAll('[id]')].map(el => el.id),
    }));
    anchorIdsByPage.set(u, new Set(ids));

    for (const href of links) {
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:') || href === '#') continue;
      if (/^https?:\/\//.test(href) && !href.startsWith('https://toolsharp.dev')) {
        if (!externalLinks.has(href)) externalLinks.set(href, new Set());
        externalLinks.get(href).add(u);
        continue;
      }
      let resolved;
      try { resolved = new URL(href, BASE + u).pathname; } catch (e) { continue; }
      const key = resolved + '||' + u;
      if (!linkSources.has(key)) linkSources.set(key, { href, source: u, resolved });
    }
  }

  const broken = [];
  const statusCache = new Map();
  for (const { href, source, resolved } of linkSources.values()) {
    const [, hashPart] = href.split('#');
    if (!statusCache.has(resolved)) {
      const resp = await page.goto(BASE + resolved, { waitUntil: 'load' }).catch(() => null);
      statusCache.set(resolved, resp ? resp.status() : 'NAV-FAILED');
    } else if (hashPart) {
      // The status was already cached from an earlier link to this same
      // target, but the browser may well have navigated elsewhere since --
      // to a *different* resolved target checked in between this one and
      // that earlier visit. Without re-navigating here, the upcoming
      // getElementById check below would run against whatever page happens
      // to still be loaded, not `resolved`, silently mis-validating (or
      // mis-flagging) the anchor on an unrelated page. Only worth paying
      // for when there's actually a hash to verify; a plain status re-check
      // has nothing that depends on which page is currently loaded.
      await page.goto(BASE + resolved, { waitUntil: 'load' }).catch(() => null);
    }
    const status = statusCache.get(resolved);
    if (status !== 200) {
      broken.push({ href, source, reason: `${resolved} -> ${status}` });
      continue;
    }
    if (hashPart) {
      const hasAnchor = await page.evaluate((id) => !!document.getElementById(id), hashPart);
      if (!hasAnchor) broken.push({ href, source, reason: `no element with id="${hashPart}" on ${resolved}` });
    }
  }

  await browser.close();

  console.log(`=== links: ${pages.length} pages, ${linkSources.size} unique internal link occurrences, ${externalLinks.size} unique external ===`);
  if (broken.length) {
    console.log(`BROKEN (${broken.length}):`);
    broken.forEach(b => console.log(` - "${b.href}" in ${b.source} -- ${b.reason}`));
  } else {
    console.log('No broken internal links.');
  }
  console.log(`External links (not fetched -- review manually if the list changes): ${[...externalLinks.keys()].join(', ')}`);
  return broken.length === 0;
}

module.exports = { run };
