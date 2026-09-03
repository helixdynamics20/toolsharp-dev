// Accessibility sweep across every page: unlabeled form controls, buttons
// with no accessible name, images without alt, heading-order jumps,
// missing <html lang>, and links with no discernible text. Runs against
// desktop width via serve.js's rewrite-aware server (real clean URLs).
//
// Known accepted findings (verified by hand, not real defects -- see the
// project's own testing history): a hidden anti-spam honeypot checkbox on
// /contact (display:none + tabindex="-1", correctly invisible to everyone
// including screen readers), and links inside collapsed FAQ <details>
// elements (innerText-based checks can't see collapsed content, but it's
// fully reachable once expanded -- a checker limitation, not a real gap).

const { chromium } = require('playwright');
const listPageUrls = require('./_pages');

const KNOWN_OK = new Set([
  '/contact: unlabeled control #checkbox',
  '/guides/cron-expression-cheat-sheet: link with no text',
  '/guides/json-invisible-characters-explained: link with no text',
]);

async function run(BASE) {
  const urls = listPageUrls();
  const browser = await chromium.launch();
  const findings = [];

  for (const u of urls) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(BASE + u, { waitUntil: 'load' });
    await page.waitForTimeout(200);

    const issues = await page.evaluate(() => {
      const out = [];
      document.querySelectorAll('img:not([alt])').forEach(() => out.push('img without alt'));
      document.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
        const id = el.id;
        const hasLabel = id && document.querySelector(`label[for="${CSS.escape(id)}"]`);
        const named = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.closest('label');
        if (!hasLabel && !named) out.push(`unlabeled control #${id || el.type || el.tagName}`);
      });
      document.querySelectorAll('button').forEach(b => {
        if (!b.innerText.trim() && !b.getAttribute('aria-label')) out.push('button with no accessible name');
      });
      const hs = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => +h.tagName[1]);
      const h1s = hs.filter(x => x === 1).length;
      if (h1s !== 1) out.push(`${h1s} h1 elements`);
      for (let i = 1; i < hs.length; i++) if (hs[i] - hs[i - 1] > 1) { out.push(`heading jump h${hs[i - 1]}->h${hs[i]}`); break; }
      document.querySelectorAll('a[href]').forEach(a => {
        if (!a.innerText.trim() && !a.getAttribute('aria-label') && !a.querySelector('img,svg')) out.push('link with no text');
      });
      if (!document.documentElement.lang) out.push('missing <html lang>');
      return out;
    });

    for (const issue of new Set(issues)) {
      const key = `${u}: ${issue}`;
      if (!KNOWN_OK.has(key)) findings.push(key);
    }
    await page.close();
  }

  await browser.close();
  console.log(`=== accessibility: ${urls.length} pages ===`);
  if (findings.length) {
    console.log('NEW FINDINGS (not in the known-OK list -- investigate before assuming it\'s another false positive):');
    findings.forEach(f => console.log(' - ' + f));
  } else {
    console.log('No new accessibility issues (known false positives excluded, see KNOWN_OK in this file).');
  }
  return findings.length === 0;
}

module.exports = { run };
