// Shared page-chrome templates -- the <head> script block, <header>, and
// <footer> markup that every one of the site's 50+ pages used to hand-copy
// (verified byte-for-byte identical, modulo per-page content, across a
// sample of guide/tool/root pages before this was written). That's exactly
// why every previous site-wide chrome change (self-hosting fonts, adding
// catalog.js) needed a one-off codemod across dozens of files instead of a
// single edit: there was no single place to edit.
//
// A source file marks where each piece goes with a literal
// <!--HEAD-COMMON-->, <!--HEAD-COMMON-TAIL-->, <!--HEADER-->, <!--FOOTER-->
// HTML comment; renderPage() resolves the right variant for that specific
// file from its path and splices the real markup in. Changing shared chrome
// now means editing one render function here, not re-running a codemod.
//
// A separate module from build.js on purpose: build.js runs its entire
// build as a side effect of being loaded, so anything needing to reuse this
// logic without triggering a full build (scripts/migrate-page-chrome.js,
// namely) needs it importable on its own.
//
// Deliberately NOT covering the rest of <head> (title/description/canonical/
// OG/twitter/structured data) -- that content is genuinely unique per page
// and already the right place for it to be hand-authored, the same
// reasoning js/catalog.js's own header comment gives for why tools/index.html,
// guides/index.html, sitemap.xml, and llms.txt stay hand-written too.

// basePath is '/' for a page living at the site root, '../' for a page one
// directory deep (tools/, guides/) -- every nav/footer link is built from
// this one value, so a third directory depth would only need a new case
// here, not a new template shape.
function resolveBasePath(relPath) {
  const depth = relPath.split('/').length - 1;
  return depth === 0 ? '/' : '../'.repeat(depth);
}

// Asset hrefs (css/js) use a *relative* prefix at root ('', i.e. plain
// "css/style.css") rather than basePath's absolute '/' -- that's the
// convention every root page already used before this refactor, kept as-is
// rather than "normalized" to an absolute form that would still resolve
// identically but wasn't worth treating as a behavior change.
function resolveAssetBasePath(relPath) {
  const depth = relPath.split('/').length - 1;
  return depth === 0 ? '' : '../'.repeat(depth);
}

function renderHeadCommon(assetBasePath) {
  return [
    '<link rel="preload" href="/assets/fonts/ibm-plex-sans.woff2" as="font" type="font/woff2" crossorigin>',
    '<link rel="preload" href="/assets/fonts/ibm-plex-mono-400.woff2" as="font" type="font/woff2" crossorigin>',
    `<link rel="stylesheet" href="${assetBasePath}css/style.css">`,
    `<script src="${assetBasePath}js/catalog.js" defer></script>`,
    `<script src="${assetBasePath}js/theme.js" defer></script>`,
    `<script src="${assetBasePath}js/nav.js" defer></script>`,
    `<script src="${assetBasePath}js/utils.js" defer></script>`,
  ].join('\n');
}

// The tail end of the shared script block (Speed Insights + analytics) is
// split from renderHeadCommon() above so a page's own extra scripts
// (terminal.js, epoch-clock.js, ...) can sit between the two markers in the
// source file -- after catalog/theme/utils (which they may depend on),
// before the analytics bundle (which nothing depends on).
function renderHeadCommonTail(assetBasePath) {
  return [
    `<script src="${assetBasePath}js/speed-insights.js" defer></script>`,
    `<script type="module" src="${assetBasePath}js/analytics.bundle.js"></script>`,
  ].join('\n');
}

// navVariant: 'home' (index.html: adds tools/guides quick links) or null
// (every other page: just the logo + dark-mode toggle). 404.html has its
// own third variant (tools/#about links) but is excluded from this
// template entirely -- see scripts/migrate-page-chrome.js for why.
//
// The extra links join with a literal space, not nothing -- these are
// adjacent inline <a> elements, and the original hand-written markup had
// them on separate indented lines, which html-minifier-terser's
// collapseWhitespace collapses to a single space rather than removing
// (removing it would visibly join "tools/" and "guides/" together on the
// rendered page). Concatenating with no separator here would silently
// close that gap.
function renderHeader(basePath, navVariant) {
  const logo = `<a class="logo" href="${basePath}"><span class="term-dots"><span></span><span></span><span></span></span>tool<span class="accent">sharp</span><span class="dim">.dev</span></a>`;
  const navLinks = [];
  if (navVariant === 'home') navLinks.push(`<a href="${basePath}tools">tools/</a>`, `<a href="${basePath}guides">guides/</a>`);
  navLinks.push('<a href="#" id="darkModeToggle"></a>');
  return [
    '<header class="site-header">',
    '<div class="wrap">',
    logo,
    `<nav class="nav-links">${navLinks.join(' ')}</nav>`,
    '</div>',
    '</header>',
  ].join('\n');
}

// footerVariant: 'home' (index.html/404.html: tagline instead of a back-link,
// since there's nowhere "back" to go) or 'standard' (every other page: a
// back-link to the homepage). excludeLink: the one legal-page link a legal
// page itself omits (privacy-policy.html doesn't link to itself, etc.) --
// null everywhere else.
function renderFooter(basePath, footerVariant, excludeLink) {
  const first = footerVariant === 'home'
    ? '<span>toolsharp.dev — built by a developer, for developers</span>'
    : `<span><a href="${basePath}">← toolsharp.dev</a></span>`;
  const links = [];
  if (excludeLink !== 'privacy-policy') links.push(`<a href="${basePath}privacy-policy">privacy policy</a>`);
  if (excludeLink !== 'terms') links.push(`<a href="${basePath}terms">terms</a>`);
  if (excludeLink !== 'contact') links.push(`<a href="${basePath}contact">contact</a>`);
  return [
    '<footer>',
    '<div class="wrap">',
    first,
    `<span>${links.join(' · ')}</span>`,
    '<span>runs entirely in your browser</span>',
    '</div>',
    '</footer>',
  ].join('\n');
}

// Resolves the right variant/excludeLink for a file purely from its
// site-relative path (e.g. 'index.html', 'tools/json-formatter.html') --
// nothing here needs touching when a new tool or guide is added, since
// those all fall through to the 'standard'/null defaults.
function resolvePageChrome(relPath) {
  const basePath = resolveBasePath(relPath);
  const assetBasePath = resolveAssetBasePath(relPath);
  if (relPath === 'index.html') return { basePath, assetBasePath, navVariant: 'home', footerVariant: 'home', excludeLink: null };
  if (relPath === 'privacy-policy.html') return { basePath, assetBasePath, navVariant: null, footerVariant: 'standard', excludeLink: 'privacy-policy' };
  if (relPath === 'terms.html') return { basePath, assetBasePath, navVariant: null, footerVariant: 'standard', excludeLink: 'terms' };
  if (relPath === 'contact.html') return { basePath, assetBasePath, navVariant: null, footerVariant: 'standard', excludeLink: 'contact' };
  return { basePath, assetBasePath, navVariant: null, footerVariant: 'standard', excludeLink: null };
}

// Splices rendered chrome into one page's raw HTML at its markers. relPath
// is the file's path relative to the repo root (e.g. 'tools/json-formatter.html')
// -- used only to resolve which variant this specific page gets, never
// written into the output. 404.html is deliberately not covered by this --
// see scripts/migrate-page-chrome.js for why -- and never reaches here.
function renderPage(html, relPath) {
  const { basePath, assetBasePath, navVariant, footerVariant, excludeLink } = resolvePageChrome(relPath);
  return html
    .replace('<!--HEAD-COMMON-->', renderHeadCommon(assetBasePath))
    .replace('<!--HEAD-COMMON-TAIL-->', renderHeadCommonTail(assetBasePath))
    .replace('<!--HEADER-->', renderHeader(basePath, navVariant))
    .replace('<!--FOOTER-->', renderFooter(basePath, footerVariant, excludeLink));
}

module.exports = {
  resolveBasePath,
  resolveAssetBasePath,
  renderHeadCommon,
  renderHeadCommonTail,
  renderHeader,
  renderFooter,
  resolvePageChrome,
  renderPage,
};
