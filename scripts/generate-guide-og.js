// Regenerates the branded 1200x630 OG/Twitter card image for one or more
// guides, matching the visual style of the tools' hand-made OG images
// (dark background, dot grid, terminal-dots logo, mono type) without
// needing a design tool -- Playwright renders scripts/og-template/template.html
// with each guide's own title/description/badges and screenshots it.
//
// Requires Playwright, which is NOT a project dependency (kept out of
// package.json since it's only needed for this one-off maintenance task,
// not the site build) -- run `npm i -D playwright && npx playwright install chromium`
// once locally before using this script.
//
// Usage:
//   node scripts/generate-guide-og.js                # regenerate every guide + the guides index
//   node scripts/generate-guide-og.js what-is-a-jwt   # just one guide (slug = filename without .html)
//   node scripts/generate-guide-og.js index           # the guides hub page (guides/index.html)

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const TEMPLATE = fs.readFileSync(path.join(__dirname, 'og-template', 'template.html'), 'utf8');
const MAX_TITLE_CHARS_PER_LINE = 26; // rough fit for the 54px mono title within the card width

function wrapTitle(title) {
  if (title.length <= MAX_TITLE_CHARS_PER_LINE) return [title];
  const words = title.split(' ');
  const lines = [];
  let current = '';
  for (const word of words) {
    const next = current ? current + ' ' + word : word;
    if (next.length > MAX_TITLE_CHARS_PER_LINE && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function extractMeta(html, slug) {
  // Regex-parsing HTML is inherently fragile -- if a future guide's <h1> or
  // description doesn't fit the shape these patterns assume (an <h1> with
  // an exotic nesting structure, a missing meta description), .match()
  // returns null and indexing [1] straight into that throws a bare
  // "Cannot read properties of null", giving whoever runs this maintenance
  // script no clue which guide or which piece of markup is the problem.
  const h1Match = html.match(/<h1>([^<]*(?:<[^\/][^<]*<\/[^>]+>[^<]*)*)<\/h1>/);
  if (!h1Match) throw new Error(`${slug}: couldn't find a matching <h1> to extract the OG title from.`);
  const descMatch = html.match(/<meta name="description" content="([^"]*)"/);
  if (!descMatch) throw new Error(`${slug}: couldn't find a <meta name="description"> to extract the OG description from.`);

  const h1 = h1Match[1]
    .replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const desc = descMatch[1]
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
  const badges = [...html.matchAll(/<span class="badge">([^<]*)<\/span>/g)].map(m => m[1]).slice(0, 3);
  return { title: h1, desc, badges: badges.length ? badges : ['reference'] };
}

async function generateOne(page, slug) {
  const htmlPath = slug === 'index' ? path.join(REPO, 'guides', 'index.html') : path.join(REPO, 'guides', slug + '.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { title, desc, badges } = extractMeta(html, slug);
  const titleLines = wrapTitle(title);

  await page.setContent(TEMPLATE);
  await page.evaluate(({ titleLines, desc, badges }) => {
    document.getElementById('og-title').innerHTML = titleLines.map(l =>
      l.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    ).join('<br>');
    document.getElementById('og-desc').textContent = desc;
    document.getElementById('og-badges').innerHTML = badges.map(b => `<span class="badge">${b}</span>`).join('');
  }, { titleLines, desc, badges });

  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);

  const outPath = path.join(REPO, 'assets', 'og', 'guide-' + slug + '.png');
  await page.screenshot({ path: outPath });
  console.log('generated', path.relative(REPO, outPath));
}

(async () => {
  const requested = process.argv.slice(2);
  const slugs = requested.length
    ? requested
    : ['index', ...fs.readdirSync(path.join(REPO, 'guides'))
        .filter(f => f.endsWith('.html') && f !== 'index.html')
        .map(f => f.replace(/\.html$/, ''))];

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const slug of slugs) await generateOne(page, slug);
  await browser.close();
})();
