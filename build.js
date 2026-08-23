const fs = require('fs');
const path = require('path');
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
  'service-worker.js'
];

staticFiles.forEach(file => {
  const src = path.join(srcDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(distDir, file));
  }
});

// Copy assets directory contents
const assetDir = path.join(srcDir, 'assets');
if (fs.existsSync(assetDir)) {
  fs.readdirSync(assetDir).forEach(file => {
    fs.copyFileSync(path.join(assetDir, file), path.join(distDir, 'assets', file));
  });
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
}

async function main() {
  await processJs();
  await processHtml();
  console.log('Build completed successfully!');
}

main().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
