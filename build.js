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

// Every tool/guide has to be registered in several places: js/catalog.js
// (theme.js's command palette, nav dropdown, and terminal all derive from
// this one file now, instead of each keeping its own copy -- that setup
// already caused a real bug once, a new guide missing from the palette),
// plus the relevant index.html, sitemap.xml, and llms.txt, which still
// carry their own hand-written HTML/prose and can't just be generated from
// catalog.js without flattening content that's deliberately worded
// differently per place.
//
// This loops over catalog.js's `types` array generically -- nothing here
// hardcodes "tools"/"guides" by name, so a new content type registered in
// catalog.js (see the comment block at the top of that file) gets exactly
// the same validation as the existing two automatically, no changes needed
// here. For each type it diffs catalog.js against the actual .html files
// on disk, that type's index.html, sitemap.xml, and llms.txt, plus checks
// every declared category has a matching section in the index page,
// failing the build the moment any one of them drifts instead of silently
// shipping a tool/guide/category that's reachable from some places but not
// others.
function validateRegistration() {
  const errors = [];

  delete require.cache[require.resolve(path.join(srcDir, 'js/catalog.js'))];
  const catalog = require(path.join(srcDir, 'js/catalog.js'));

  const sitemap = fs.readFileSync(path.join(srcDir, 'sitemap.xml'), 'utf8');
  const llms = fs.readFileSync(path.join(srcDir, 'llms.txt'), 'utf8');

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

  const summary = [];

  for (const type of catalog.types) {
    const typeDir = path.join(srcDir, type.key);
    const diskFiles = fs.readdirSync(typeDir)
      .filter(f => f.endsWith('.html') && f !== 'index.html')
      .map(f => f.replace(/\.html$/, ''));

    const pathPrefix = new RegExp('^/' + type.key + '/');
    const catalogSlugs = type.items.map(it => it.path.replace(pathPrefix, ''));

    const indexHtml = fs.readFileSync(path.join(typeDir, 'index.html'), 'utf8');
    const indexSlugs = [...indexHtml.matchAll(new RegExp('data-row-href="/' + type.key + '/([^"]+)"', 'g'))].map(m => m[1]);

    const sitemapSlugs = [...sitemap.matchAll(new RegExp('<loc>https://toolsharp\\.dev/' + type.key + '/([^<]+)</loc>', 'g'))].map(m => m[1]);
    const llmsSlugs = [...llms.matchAll(new RegExp('\\(https://toolsharp\\.dev/' + type.key + '/([^)]+)\\)', 'g'))].map(m => m[1]);

    checkSet(type.kindLabel, diskFiles, {
      'js/catalog.js': catalogSlugs,
      [`${type.key}/index.html`]: indexSlugs,
      'sitemap.xml': sitemapSlugs,
      'llms.txt': llmsSlugs,
    });

    // catalog.js's `categories` array is itself the single source for
    // which categories exist -- theme.js's nav dropdown reads the same
    // array, so a category can't silently drift the way individual
    // tools/guides used to. Two things get checked: every item's
    // `category` is one the type actually declares, and every declared
    // category has a matching <div class="dir-category"> section in its
    // index.html (catching "added a category to the catalog, forgot to
    // add its listing section").
    for (const it of type.items) if (!type.categories.includes(it.category)) errors.push(`${type.kindLabel} "${it.path}" has unrecognized category "${it.category}" (not in catalog types.${type.key}.categories)`);

    const indexCategories = [...indexHtml.matchAll(/<div class="dir-category"[^>]*>([^<]+)<\/div>/g)].map(m => m[1].replace(/\/$/, ''));
    for (const cat of type.categories) if (!indexCategories.includes(cat)) errors.push(`${type.kindLabel} category "${cat}" is in catalog (types.${type.key}) but has no matching section in ${type.key}/index.html`);

    summary.push(`${diskFiles.length} ${type.key}`);
  }

  if (errors.length) {
    console.error('\nRegistration consistency check failed -- build aborted:\n');
    errors.forEach(e => console.error('  - ' + e));
    console.error('\nEvery item must be registered in all of: js/catalog.js, its type\'s index.html, sitemap.xml, and llms.txt.\n');
    process.exit(1);
  }
  console.log(`Registration check passed: ${summary.join(', ')}, all in sync.`);
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
