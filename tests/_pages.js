// Shared by every test script: the list of real clean-URL pages the site
// actually has, derived from the built dist/ output rather than hand-
// maintained, so a new tool/guide is automatically covered.

const fs = require('fs');
const path = require('path');
const { DIST } = require('./serve');

module.exports = function listPageUrls() {
  const urls = ['/'];
  const walk = (dir, prefix) => {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isDirectory()) {
        if (['assets', 'css', 'js', 'api'].includes(f)) continue;
        walk(p, prefix + '/' + f);
      } else if (f.endsWith('.html') && f !== 'index.html' && f !== '404.html' && !f.startsWith('google')) {
        urls.push(prefix + '/' + f.replace(/\.html$/, ''));
      } else if (f === 'index.html' && prefix) {
        urls.push(prefix);
      }
    }
  };
  walk(DIST, '');
  return [...new Set(urls)].sort();
};
