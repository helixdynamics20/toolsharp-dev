// Crawls every real page (clean URLs, via serve.js's vercel.json-rewrite-
// aware server) at desktop and mobile widths in light mode, checking for
// JS errors, horizontal overflow, and failed/4xx/5xx requests -- plus a
// third, desktop-only pass in dark mode.
//
// Dark mode gets its own pass rather than being a third full viewport x
// theme combination because its real risk is different: not layout
// (already covered twice, light desktop + light mobile) but color --
// an element that forgets to redefine its background under
// body.dark-theme and silently stays a bright white box. That's a real,
// previously-real bug class on this project (share-pad's code display,
// the curl-converter language select both needed an explicit dark-theme
// rule after a structural change), so the dark pass specifically scans
// for exactly that shape of element instead of just re-running the same
// generic checks under a different class name.

const { chromium } = require('playwright');
const listPageUrls = require('./_pages');

async function checkPage(browser, BASE, u, vp, opts) {
  const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
  const jsErrors = [];
  const failed = [];
  page.on('pageerror', e => jsErrors.push(String(e).slice(0, 140)));
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' HTTP ' + r.status()); });

  const issues = [];
  const tag = opts.dark ? 'dark' : vp.tag;

  if (opts.dark) {
    // localStorage has to be set before theme.js's own DOMContentLoaded
    // check runs, so: load once to establish the origin, set it, then
    // reload -- matches how a real returning visitor's toggle persists.
    await page.goto(BASE + u, { waitUntil: 'load', timeout: 30000 }).catch(() => null);
    await page.evaluate(() => { try { localStorage.setItem('toolsharp-dark-theme', 'true'); } catch (e) {} });
  }

  const resp = await page.goto(BASE + u, { waitUntil: 'load', timeout: 30000 }).catch(e => {
    issues.push(`${u} [${tag}] NAV-FAILED ${e.message.slice(0, 100)}`);
    return null;
  });

  if (resp) {
    if (resp.status() !== 200) issues.push(`${u} [${tag}] HTTP ${resp.status()}`);
    await page.waitForTimeout(250);

    if (opts.dark) {
      const isDark = await page.evaluate(() => document.body.classList.contains('dark-theme'));
      if (!isDark) issues.push(`${u} [${tag}] dark-theme class never applied`);

      // A meaningfully-sized element with a near-white background while
      // the page is in dark mode -- the exact shape of the two real bugs
      // this check exists to catch. Small elements (icons, dots) are
      // excluded deliberately; those are legitimately white sometimes.
      const whiteBoxes = await page.evaluate(() => {
        const isWhiteish = (c) => {
          const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
          if (!m) return false;
          const [r, g, b] = [+m[1], +m[2], +m[3]];
          return r > 245 && g > 245 && b > 245;
        };
        // #mdPreviewFrame is deliberately excluded: markdown-previewer
        // renders its preview in GitHub's own light colors (#fff, #f6f8fa)
        // on purpose, so what you see matches how the markdown will
        // actually look rendered elsewhere -- correctly independent of
        // this site's own theme, not a missed dark-theme rule.
        const KNOWN_OK_IDS = new Set(['mdPreviewFrame']);
        const hits = [];
        document.querySelectorAll('body *').forEach(el => {
          if (KNOWN_OK_IDS.has(el.id)) return;
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 20) return;
          const bg = getComputedStyle(el).backgroundColor;
          if (isWhiteish(bg)) hits.push(el.tagName + (el.id ? '#' + el.id : '') + (el.className ? '.' + String(el.className).split(' ')[0] : ''));
        });
        return [...new Set(hits)];
      });
      if (whiteBoxes.length) issues.push(`${u} [${tag}] WHITE-BOX-IN-DARK-MODE ${whiteBoxes.slice(0, 5).join(', ')}`);
    } else {
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      const cw = await page.evaluate(() => document.documentElement.clientWidth);
      if (sw > cw + 1) issues.push(`${u} [${tag}] H-OVERFLOW ${sw}>${cw}`);
    }
  }

  const realFailed = failed.filter(f => !f.includes('_vercel'));
  if (realFailed.length) issues.push(`${u} [${tag}] FAILED-REQ ${realFailed.join(',')}`);
  if (jsErrors.length) issues.push(`${u} [${tag}] JS-ERROR ${jsErrors.join(' | ')}`);

  await page.close();
  return issues;
}

async function run(BASE) {
  const urls = listPageUrls();
  const browser = await chromium.launch();
  const issues = [];

  for (const u of urls) {
    for (const vp of [{ w: 1280, h: 900, tag: 'desktop' }, { w: 375, h: 800, tag: 'mobile' }]) {
      issues.push(...await checkPage(browser, BASE, u, vp, { dark: false }));
    }
    issues.push(...await checkPage(browser, BASE, u, { w: 1280, h: 900, tag: 'desktop' }, { dark: true }));
  }

  await browser.close();
  console.log(`=== crawl: ${urls.length} pages x2 light viewports + 1 dark pass ===`);
  if (issues.length) {
    console.log('ISSUES:\n' + issues.map(i => ' - ' + i).join('\n'));
  } else {
    console.log('No errors, no overflow, no failed requests, no unstyled white boxes in dark mode.');
  }
  return issues.length === 0;
}

module.exports = { run };
