// One-time migration: replaces each source HTML file's hand-copied
// head-common/header/footer markup with the <!--HEAD-COMMON-->/
// <!--HEAD-COMMON-TAIL-->/<!--HEADER-->/<!--FOOTER--> markers that
// scripts/page-chrome.js's renderPage() fills in at build time.
//
// Never guesses: for every file, the markup currently there is normalized
// (whitespace-insensitive) and compared against what renderPage() would
// produce for that exact file. Only an exact match gets rewritten -- any
// file whose actual markup doesn't match the expected render is reported
// and left untouched, so a real discrepancy surfaces as a loud error
// instead of silently baking in a regression.
//
// Usage: node scripts/migrate-page-chrome.js [--dry-run]

const fs = require('fs');
const path = require('path');
const { resolvePageChrome, renderHeader, renderFooter, renderHeadCommon, renderHeadCommonTail } = require('./page-chrome.js');

const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

// 404.html deliberately excluded: it carries a smaller, genuinely different
// script set (no utils.js -- a 404 page needs no clipboard/download/
// form-persistence helpers) and is noindex'd anyway, so it stays
// hand-authored rather than growing a one-off variant into the shared
// templates for a single page.
const EXCLUDED = new Set(['404.html', 'google461995a17a0d27be.html']);

function listFiles() {
  const files = [];
  for (const f of fs.readdirSync(ROOT)) {
    if (f.endsWith('.html') && !EXCLUDED.has(f)) files.push(f);
  }
  for (const dir of ['tools', 'guides']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (f.endsWith('.html')) files.push(dir + '/' + f);
    }
  }
  return files;
}

// Whitespace-insensitive comparison only -- html-minifier-terser collapses
// whitespace at build time anyway, so two renderings that differ only in
// indentation/line breaks produce identical final output.
function normalize(s) {
  return s.replace(/>\s+</g, '><').replace(/\s+/g, ' ').trim();
}

const errors = [];
let migrated = 0;
let skipped = 0;

for (const relPath of listFiles()) {
  const filePath = path.join(ROOT, relPath);
  let html = fs.readFileSync(filePath, 'utf8');
  const { basePath, assetBasePath, navVariant, footerVariant, excludeLink } = resolvePageChrome(relPath);

  // ---- head-common block: font preloads through the analytics bundle ----
  const fontPreloadRe = /<link rel="preload" href="\/assets\/fonts\/ibm-plex-sans\.woff2"[^>]*>/;
  const analyticsRe = /<script type="module" src="[^"]*js\/analytics\.bundle\.js"><\/script>/;
  const startMatch = fontPreloadRe.exec(html);
  const endMatch = startMatch ? analyticsRe.exec(html.slice(startMatch.index)) : null;
  if (!startMatch || !endMatch) { errors.push(`${relPath}: could not locate the head-common block`); continue; }
  const blockStart = startMatch.index;
  const blockEnd = startMatch.index + endMatch.index + endMatch[0].length;
  const blockText = html.slice(blockStart, blockEnd);

  const utilsRe = /<script src="[^"]*js\/utils\.js" defer><\/script>/;
  const utilsMatch = utilsRe.exec(blockText);
  if (!utilsMatch) { errors.push(`${relPath}: no utils.js tag inside its head-common block`); continue; }
  const prefixActual = blockText.slice(0, utilsMatch.index + utilsMatch[0].length);
  const prefixExpected = renderHeadCommon(assetBasePath);
  if (normalize(prefixActual) !== normalize(prefixExpected)) {
    errors.push(`${relPath}: head-common PREFIX doesn't match the expected render\n    expected: ${normalize(prefixExpected)}\n    actual:   ${normalize(prefixActual)}`);
    continue;
  }

  const speedRe = /<script src="[^"]*js\/speed-insights\.js" defer><\/script>/;
  const speedMatch = speedRe.exec(blockText);
  if (!speedMatch) { errors.push(`${relPath}: no speed-insights.js tag inside its head-common block`); continue; }
  const suffixActual = blockText.slice(speedMatch.index);
  const suffixExpected = renderHeadCommonTail(assetBasePath);
  if (normalize(suffixActual) !== normalize(suffixExpected)) {
    errors.push(`${relPath}: head-common TAIL doesn't match the expected render\n    expected: ${normalize(suffixExpected)}\n    actual:   ${normalize(suffixActual)}`);
    continue;
  }

  const extras = blockText.slice(utilsMatch.index + utilsMatch[0].length, speedMatch.index).trim();
  const newHeadBlock = extras ? `<!--HEAD-COMMON-->\n${extras}\n<!--HEAD-COMMON-TAIL-->` : `<!--HEAD-COMMON-->\n<!--HEAD-COMMON-TAIL-->`;

  // ---- header ----
  const headerRe = /<header class="site-header">[\s\S]*?<\/header>/;
  const headerMatch = headerRe.exec(html);
  if (!headerMatch) { errors.push(`${relPath}: no <header class="site-header"> found`); continue; }
  const headerExpected = renderHeader(basePath, navVariant);
  if (normalize(headerMatch[0]) !== normalize(headerExpected)) {
    errors.push(`${relPath}: header doesn't match the expected render\n    expected: ${normalize(headerExpected)}\n    actual:   ${normalize(headerMatch[0])}`);
    continue;
  }

  // ---- footer (first one only -- every page has exactly one) ----
  const footerRe = /<footer>[\s\S]*?<\/footer>/;
  const footerMatch = footerRe.exec(html);
  if (!footerMatch) { errors.push(`${relPath}: no <footer> found`); continue; }
  const footerExpected = renderFooter(basePath, footerVariant, excludeLink);
  if (normalize(footerMatch[0]) !== normalize(footerExpected)) {
    errors.push(`${relPath}: footer doesn't match the expected render\n    expected: ${normalize(footerExpected)}\n    actual:   ${normalize(footerMatch[0])}`);
    continue;
  }

  // All three validated -- apply replacements from the end of the file
  // backward so earlier splice indices stay valid.
  const replacements = [
    { start: footerMatch.index, end: footerMatch.index + footerMatch[0].length, text: '<!--FOOTER-->' },
    { start: headerMatch.index, end: headerMatch.index + headerMatch[0].length, text: '<!--HEADER-->' },
    { start: blockStart, end: blockEnd, text: newHeadBlock },
  ].sort((a, b) => b.start - a.start);

  let out = html;
  for (const r of replacements) out = out.slice(0, r.start) + r.text + out.slice(r.end);

  if (!DRY_RUN) fs.writeFileSync(filePath, out);
  migrated++;
}

console.log(`${DRY_RUN ? '[dry run] ' : ''}Migrated: ${migrated}, skipped (errors): ${errors.length}`);
if (errors.length) {
  console.log(`\nFiles NOT touched (need manual review):\n`);
  errors.forEach(e => console.log(' - ' + e + '\n'));
  process.exit(1);
}
