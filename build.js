const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const CleanCSS = require('clean-css');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');

const srcDir = __dirname;
const distDir = path.join(__dirname, 'dist');

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
  'service-worker.js',
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
    const input = fs.readFileSync(srcPath, 'utf8');
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
    const input = fs.readFileSync(srcPath, 'utf8');
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
    const input = fs.readFileSync(srcPath, 'utf8');
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
  console.log('Build completed successfully!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
