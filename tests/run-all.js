// Runs the full E2E suite against a built dist/ -- crawl, links, a11y,
// tools, FAQ sync -- and exits non-zero if any of them found something.
// Wired into CI (.github/workflows/build.yml) so a regression fails the
// PR instead of only being caught when someone happens to ask for a
// manual testing round.
//
// Usage: npm run build && node tests/run-all.js

const fs = require('fs');
const path = require('path');
const { startServer, DIST } = require('./serve');

const PORT = 8199;
const BASE = `http://localhost:${PORT}`;

async function main() {
  if (!fs.existsSync(DIST) || !fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error(`dist/ not found or incomplete (looked in ${DIST}). Run "npm run build" first.`);
    process.exit(1);
  }

  const server = await startServer(PORT);
  console.log(`Serving ${DIST} at ${BASE}\n`);

  const suites = [
    ['crawl', () => require('./crawl').run(BASE)],
    ['links', () => require('./links').run(BASE)],
    ['a11y', () => require('./a11y').run(BASE)],
    ['tools', () => require('./tools').run(BASE)],
    ['faq-sync', () => require('./faq-sync').run()],
  ];

  const results = [];
  for (const [name, fn] of suites) {
    console.log(`\n----- ${name} -----`);
    let ok;
    try {
      ok = await fn();
    } catch (e) {
      console.error(`${name} threw: ${e.stack || e}`);
      ok = false;
    }
    results.push([name, ok]);
  }

  server.close();

  console.log('\n===== summary =====');
  let allOk = true;
  for (const [name, ok] of results) {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
    if (!ok) allOk = false;
  }

  process.exit(allOk ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
