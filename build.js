const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

// One version stamp per build, appended as a query string to every local
// css/js reference. Paired with the immutable long-cache headers in
// vercel.json (safe only because this changes on every deploy) -- without
// it, a long cache lifetime on an unversioned filename would leave
// visitors stuck on stale CSS/JS after every future deploy.
const BUILD_VERSION = Date.now().toString(36);

// Appends ?v=<BUILD_VERSION> to href/src attributes pointing at a local
// (non-http) .css or .js file. Leaves external resources (Google Fonts)
// untouched.
function versionAssetUrls(html) {
  return html.replace(/(href|src)="([^"]+\.(?:css|js))"/g, (match, attr, url) => {
    if (/^https?:\/\//i.test(url)) return match;
    return `${attr}="${url}?v=${BUILD_VERSION}"`;
  });
}

// Clean and create dist directory
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir);
fs.mkdirSync(path.join(distDir, 'css'));
fs.mkdirSync(path.join(distDir, 'js'));
fs.mkdirSync(path.join(distDir, 'tools'));
fs.mkdirSync(path.join(distDir, 'guides'));
fs.mkdirSync(path.join(distDir, 'assets'));
fs.mkdirSync(path.join(distDir, 'api'));

// Every tool/guide has to be registered in several hand-maintained places
// (theme.js's command palette, theme.js's nav category dropdown, the
// relevant index.html, sitemap.xml) with no single source of truth --
// exactly the setup that already caused a real bug once (a new guide
// missing from the palette). Rather than trust hand-editing to catch every
// spot next time, this diffs each list against the actual .html files on
// disk and fails the build the moment any one of them drifts, instead of
// silently shipping a tool/guide that's reachable from some pages but not
// others.
function validateRegistration() {
  const errors = [];

  const toolFiles = fs.readdirSync(path.join(srcDir, 'tools'))
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => f.replace(/\.html$/, ''));
  const guideFiles = fs.readdirSync(path.join(srcDir, 'guides'))
    .filter(f => f.endsWith('.html') && f !== 'index.html')
    .map(f => f.replace(/\.html$/, ''));

  const themeJs = fs.readFileSync(path.join(srcDir, 'js/theme.js'), 'utf8');
  const toolsIndexHtml = fs.readFileSync(path.join(srcDir, 'tools/index.html'), 'utf8');
  const guidesIndexHtml = fs.readFileSync(path.join(srcDir, 'guides/index.html'), 'utf8');
  const sitemap = fs.readFileSync(path.join(srcDir, 'sitemap.xml'), 'utf8');

  const extractBetween = (text, startMarker, endMarker) => {
    const start = text.indexOf(startMarker);
    const end = text.indexOf(endMarker, start);
    if (start === -1 || end === -1) return '';
    return text.slice(start, end);
  };

  const toolsListBlock = extractBetween(themeJs, 'var toolsList = [', 'var guidesList = [');
  const paletteTools = [...toolsListBlock.matchAll(/path:\s*'\/tools\/([^']+)'/g)].map(m => m[1]);

  const guidesListBlock = extractBetween(themeJs, 'var guidesList = [', 'window.TOOLSHARP_TOOLS');
  const paletteGuides = [...guidesListBlock.matchAll(/path:\s*'\/guides\/([^']+)'/g)].map(m => m[1]);

  const categoriesBlock = extractBetween(themeJs, 'var categories = [', 'var dropdownContainer');
  const navDropdownTools = [...categoriesBlock.matchAll(/path:\s*'tools\/([^']+)'/g)].map(m => m[1]);

  const toolsIndexTools = [...toolsIndexHtml.matchAll(/data-row-href="\/tools\/([^"]+)"/g)].map(m => m[1]);
  const guidesIndexGuides = [...guidesIndexHtml.matchAll(/data-row-href="\/guides\/([^"]+)"/g)].map(m => m[1]);

  const sitemapTools = [...sitemap.matchAll(/<loc>https:\/\/toolsharp\.dev\/tools\/([^<]+)<\/loc>/g)].map(m => m[1]);
  const sitemapGuides = [...sitemap.matchAll(/<loc>https:\/\/toolsharp\.dev\/guides\/([^<]+)<\/loc>/g)].map(m => m[1]);

  function checkSet(kind, groundTruth, sets) {
    for (const slug of groundTruth) {
      for (const [name, list] of Object.entries(sets)) {
        if (!list.includes(slug)) errors.push(`${kind} "${slug}" exists on disk but is missing from ${name}`);
      }
    }
    for (const [name, list] of Object.entries(sets)) {
      for (const slug of list) {
        if (!groundTruth.includes(slug)) errors.push(`${kind} "${slug}" is referenced in ${name} but no such file exists in ${kind}s/`);
      }
    }
  }

  checkSet('tool', toolFiles, {
    'theme.js command palette (toolsList)': paletteTools,
    'theme.js nav dropdown (categories)': navDropdownTools,
    'tools/index.html': toolsIndexTools,
    'sitemap.xml': sitemapTools,
  });
  checkSet('guide', guideFiles, {
    'theme.js command palette (guidesList)': paletteGuides,
    'guides/index.html': guidesIndexGuides,
    'sitemap.xml': sitemapGuides,
  });

  if (errors.length) {
    console.error('\nRegistration consistency check failed -- build aborted:\n');
    errors.forEach(e => console.error('  - ' + e));
    console.error('\nEvery tool/guide must be registered in all of: theme.js (palette, and the nav dropdown for tools), the relevant index.html, and sitemap.xml.\n');
    process.exit(1);
  }
  console.log(`Registration check passed: ${toolFiles.length} tools, ${guideFiles.length} guides, all in sync.`);
}

// Helper to ensure target directories exist
function ensureDirectoryExistence(filePath) {
  const dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

// Copy static assets directly
const staticFiles = [
  'favicon.svg',
  'robots.txt',
  'sitemap.xml',
  'google461995a17a0d27be.html',
  'BingSiteAuth.xml',
  'LICENSE',
  'manifest.json',
  'ads.txt',
  'llms.txt',
  '7d651288514fb3e2d4dbc8ae19450700.txt'
];

staticFiles.forEach(file => {
  const src = path.join(srcDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
});

// Copy assets directory contents (recursively, so subfolders like assets/og/ work)
const assetDir = path.join(srcDir, 'assets');
if (fs.existsSync(assetDir)) {
  fs.cpSync(assetDir, path.join(distDir, 'assets'), { recursive: true });
}

// Copy api directory contents (Vercel serverless function files, kept as-is)
const apiDir = path.join(srcDir, 'api');
if (fs.existsSync(apiDir)) {
  fs.readdirSync(apiDir).forEach(file => {
    fs.copyFileSync(path.join(apiDir, file), path.join(distDir, 'api', file));
  });
}

// CSS Minification
const cleanCss = new CleanCSS({});
const cssFiles = fs.readdirSync(path.join(srcDir, 'css')).filter(f => f.endsWith('.css'));
cssFiles.forEach(file => {
  const srcPath = path.join(srcDir, 'css', file);
  const input = fs.readFileSync(srcPath, 'utf8');
  const output = cleanCss.minify(input).styles;
  fs.writeFileSync(path.join(distDir, 'css', file), output);
  console.log(`Minified CSS: css/${file}`);
});

// JS Minification function
async function processJs() {
  const jsDir = path.join(srcDir, 'js');
  const jsFiles = fs.readdirSync(jsDir).filter(f => f.endsWith('.js'));
  for (const file of jsFiles) {
    const srcPath = path.join(jsDir, file);
    const input = fs.readFileSync(srcPath, 'utf8');
    try {
      const minified = await minifyJs(input, {
        mangle: true,
        compress: true
      });
      fs.writeFileSync(path.join(distDir, 'js', file), minified.code);
      console.log(`Minified JS: js/${file}`);
    } catch (err) {
      console.error(`Error minifying JS js/${file}:`, err);
    }
  }
}

// Service worker: the ASSETS precache list references css/js paths as plain
// string literals (not HTML attributes), so it needs its own pass to stay
// consistent with the versioned URLs pages actually request. The fetch
// handler is network-first and re-caches whatever URL is actually
// requested regardless, so this mainly matters for the narrow "first-ever
// visit is offline" case -- but a stale precache entry there would be a
// real (if rare) miss, so keep it in sync rather than leaving it stale.
function processServiceWorker() {
  const srcPath = path.join(srcDir, 'service-worker.js');
  const input = fs.readFileSync(srcPath, 'utf8');
  const output = input.replace(/'(\/(?:css|js)\/[^']+\.(?:css|js))'/g, (match, url) => `'${url}?v=${BUILD_VERSION}'`);
  fs.writeFileSync(path.join(distDir, 'service-worker.js'), output);
  console.log('Versioned service-worker.js asset URLs');
}

// HTML Minification function
async function processHtml() {
  const htmlMinifyOptions = {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
    processConditionalComments: true,
    useShortDoctype: true
  };

  // Minify root HTML files
  const rootFiles = fs.readdirSync(srcDir).filter(f => f.endsWith('.html') && f !== 'google461995a17a0d27be.html');
  for (const file of rootFiles) {
    const srcPath = path.join(srcDir, file);
    const input = versionAssetUrls(fs.readFileSync(srcPath, 'utf8'));
    try {
      const output = await minifyHtml(input, htmlMinifyOptions);
      fs.writeFileSync(path.join(distDir, file), output);
      console.log(`Minified HTML: ${file}`);
    } catch (err) {
      console.error(`Error minifying HTML ${file}:`, err);
    }
  }

  // Minify tools HTML files
  const toolsDir = path.join(srcDir, 'tools');
  const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.html'));
  for (const file of toolFiles) {
    const srcPath = path.join(toolsDir, file);
    const input = versionAssetUrls(fs.readFileSync(srcPath, 'utf8'));
    try {
      const output = await minifyHtml(input, htmlMinifyOptions);
      fs.writeFileSync(path.join(distDir, 'tools', file), output);
      console.log(`Minified HTML: tools/${file}`);
    } catch (err) {
      console.error(`Error minifying HTML tools/${file}:`, err);
    }
  }

  // Minify guides HTML files
  const guidesDir = path.join(srcDir, 'guides');
  const guideFiles = fs.readdirSync(guidesDir).filter(f => f.endsWith('.html'));
  for (const file of guideFiles) {
    const srcPath = path.join(guidesDir, file);
    const input = versionAssetUrls(fs.readFileSync(srcPath, 'utf8'));
    try {
      const output = await minifyHtml(input, htmlMinifyOptions);
      fs.writeFileSync(path.join(distDir, 'guides', file), output);
      console.log(`Minified HTML: guides/${file}`);
    } catch (err) {
      console.error(`Error minifying HTML guides/${file}:`, err);
    }
  }
}

async function main() {
  validateRegistration();

  // Bundle analytics module with esbuild -- using the JS API directly
  // (not execSync + npx) so the process.env.NODE_ENV define below is
  // passed as a real value, not shell-quoted text. A shelled-out
  // --define:process.env.NODE_ENV="production" is exactly how this bundle
  // previously ended up permanently stuck loading the external debug
  // script (va.vercel-scripts.com) in every environment, prod included:
  // cmd.exe on Windows silently stripped the quotes, leaving `production`
  // as a bare (broken) identifier instead of the string "production".
  console.log('Bundling analytics module...');
  try {
    esbuild.buildSync({
      entryPoints: ['js/analytics.js'],
      bundle: true,
      format: 'esm',
      define: { 'process.env.NODE_ENV': '"production"' },
      outfile: 'js/analytics.bundle.js',
    });
    console.log('Analytics module bundled successfully');
  } catch (err) {
    console.error('Error bundling analytics module:', err);
    process.exit(1);
  }

  // Bundle vendored libraries (qrcode, marked) with esbuild -- these are
  // npm packages that expect a bundler, so we bundle once into a plain
  // script tag each tool can load, same pattern as the analytics module.
  const vendorBundles = [
    { entry: 'js/qrcode-lib.js', out: 'js/qrcode.bundle.js' },
    { entry: 'js/marked-lib.js', out: 'js/marked.bundle.js' }
  ];
  for (const { entry, out } of vendorBundles) {
    console.log(`Bundling ${entry}...`);
    try {
      esbuild.buildSync({ entryPoints: [entry], bundle: true, format: 'esm', outfile: out });
    } catch (err) {
      console.error(`Error bundling ${entry}:`, err);
      process.exit(1);
    }
  }

  await processJs();
  await processHtml();
  processServiceWorker();
  console.log('Build completed successfully!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
