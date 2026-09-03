// Crawls every real page (clean URLs, via serve.js's vercel.json-rewrite-
// aware server) at desktop and mobile widths, checking for JS errors,
// horizontal overflow, and failed/4xx/5xx requests.

const { chromium } = require('playwright');
const listPageUrls = require('./_pages');

async function run(BASE) {
  const urls = listPageUrls();
  const browser = await chromium.launch();
  const issues = [];

  for (const u of urls) {
    for (const vp of [{ w: 1280, h: 900, tag: 'desktop' }, { w: 375, h: 800, tag: 'mobile' }]) {
      const page = await browser.newPage({ viewport: { width: vp.w, height: vp.h } });
      const jsErrors = [];
      const failed = [];
      page.on('pageerror', e => jsErrors.push(String(e).slice(0, 140)));
      page.on('requestfailed', r => failed.push(r.url()));
      page.on('response', r => { if (r.status() >= 400) failed.push(r.url() + ' HTTP ' + r.status()); });

      const resp = await page.goto(BASE + u, { waitUntil: 'load', timeout: 30000 }).catch(e => {
        issues.push(`${u} [${vp.tag}] NAV-FAILED ${e.message.slice(0, 100)}`);
        return null;
      });

      if (resp) {
        if (resp.status() !== 200) issues.push(`${u} [${vp.tag}] HTTP ${resp.status()}`);
        await page.waitForTimeout(250);
        const sw = await page.evaluate(() => document.documentElement.scrollWidth);
        const cw = await page.evaluate(() => document.documentElement.clientWidth);
        if (sw > cw + 1) issues.push(`${u} [${vp.tag}] H-OVERFLOW ${sw}>${cw}`);
      }

      const realFailed = failed.filter(f => !f.includes('_vercel'));
      if (realFailed.length) issues.push(`${u} [${vp.tag}] FAILED-REQ ${realFailed.join(',')}`);
      if (jsErrors.length) issues.push(`${u} [${vp.tag}] JS-ERROR ${jsErrors.join(' | ')}`);

      await page.close();
    }
  }

  await browser.close();
  console.log(`=== crawl: ${urls.length} pages x2 viewports ===`);
  if (issues.length) {
    console.log('ISSUES:\n' + issues.map(i => ' - ' + i).join('\n'));
  } else {
    console.log('No errors, no overflow, no failed requests.');
  }
  return issues.length === 0;
}

module.exports = { run };
