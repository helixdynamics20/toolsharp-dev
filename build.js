const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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
  'LICENSE',
  'manifest.json'
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
  // Bundle analytics module with esbuild
  console.log('Bundling analytics module...');
  try {
    execSync('npx esbuild js/analytics.js --bundle --format=esm --outfile=js/analytics.bundle.js', {
      stdio: 'inherit'
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
      execSync(`npx esbuild ${entry} --bundle --format=esm --outfile=${out}`, { stdio: 'inherit' });
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
