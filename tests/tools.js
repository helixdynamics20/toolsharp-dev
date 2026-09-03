// Functional check for every tool -- real input, asserted-correct output,
// not just "did the page load." Each one is a small, targeted case, not
// exhaustive coverage; the point is catching "this tool stopped working
// entirely," which a page-load-only check can't.

const { chromium } = require('playwright');

async function read(p, sel) {
  return p.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return null;
    return ('value' in el && el.value !== undefined && el.value !== '') ? el.value : el.innerText;
  }, sel);
}
const bodyText = (p) => p.evaluate(() => document.body.innerText);

const TESTS = {
  'json-formatter': async (p) => {
    await p.fill('#jsonInput', '{"b":2,"a":[1,2,{"c":true}]}');
    await p.click('#btnJsonFormat'); await p.waitForTimeout(800);
    const t = await bodyText(p);
    return { ok: t.includes('Valid') && t.includes('"a"'), detail: 'formats and validates' };
  },
  'base64-converter': async (p) => {
    await p.fill('#b64Input', 'héllo wörld ✓');
    await p.click('#btnB64Encode'); await p.waitForTimeout(300);
    const enc = await read(p, '#b64Output');
    await p.fill('#b64Input', enc);
    await p.click('#btnB64Decode'); await p.waitForTimeout(300);
    const dec = await read(p, '#b64Output');
    return { ok: dec && dec.trim() === 'héllo wörld ✓', detail: 'UTF-8 roundtrip' };
  },
  'hash-generator': async (p) => {
    await p.fill('#hashInput', 'abc'); await p.waitForTimeout(700);
    const sha = await read(p, '#sha256Output');
    return { ok: (sha || '').includes('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), detail: 'SHA-256("abc") matches known digest' };
  },
  'epoch-converter': async (p) => {
    await p.fill('#epochInput', '1000000000'); await p.waitForTimeout(500);
    const utc = await read(p, '#utcOutput');
    return { ok: (utc || '').includes('2001'), detail: `1000000000 -> ${utc}` };
  },
  'guid-formatter': async (p) => {
    await p.click('#btnGuidGenerate'); await p.waitForTimeout(300);
    const t = await bodyText(p);
    return { ok: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(t), detail: 'valid GUID generated' };
  },
  'base-converter': async (p) => {
    await p.fill('#baseInput', '255'); await p.check('#baseDec'); await p.waitForTimeout(500);
    const hex = await read(p, '#hexOutput'), bin = await read(p, '#binOutput');
    return { ok: /ff/i.test(hex || '') && (bin || '').replace(/ /g, '').includes('11111111'), detail: `255 -> hex ${hex}, bin ${bin}` };
  },
  'url-encoder': async (p) => {
    await p.fill('#urlInput', 'a b&c=d');
    await p.click('#btnUrlEncode'); await p.waitForTimeout(250);
    const out = await read(p, '#urlOutput');
    return { ok: /%20|\+/.test(out || ''), detail: out };
  },
  'case-converter': async (p) => {
    await p.fill('#caseInput', 'getHTTPResponseCode'); await p.waitForTimeout(500);
    const snake = await read(p, '#snakeOutput');
    return { ok: (snake || '').includes('http'), detail: `snake=${snake}` };
  },
  'password-generator': async (p) => {
    await p.click('#btnPwRegenerate'); await p.waitForTimeout(500);
    const res = await read(p, '#pwResult');
    return { ok: !!res && res.length > 6, detail: `len ${res ? res.length : 0}` };
  },
  'sql-formatter': async (p) => {
    await p.fill('#sqlInput', 'select a,b from t where x in (1,2)');
    await p.click('#btnSqlFormat'); await p.waitForTimeout(400);
    const out = await read(p, '#sqlOutput');
    return { ok: (out || '').includes('SELECT') && (out || '').includes('IN ('), detail: 'formatted' };
  },
  'xml-formatter': async (p) => {
    await p.fill('#xmlInput', '<a><b attr="1">x</b></a>');
    await p.click('#btnXmlFormat'); await p.waitForTimeout(400);
    const t = await bodyText(p);
    return { ok: t.includes('attr'), detail: 'formatted with attributes preserved' };
  },
  'jwt-decoder': async (p) => {
    await p.fill('#jwtInput', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U');
    await p.waitForTimeout(600);
    const t = await bodyText(p);
    return { ok: t.includes('John Doe') && t.includes('HS256'), detail: 'header + payload decoded' };
  },
  'cron-builder': async (p) => {
    await p.fill('#cronParseInput', '0 6 * * 1');
    await p.click('#btnCronExplain'); await p.waitForTimeout(500);
    const t = await bodyText(p);
    return { ok: /Mon/.test(t), detail: 'explanation names the day correctly' };
  },
  'regex-tester': async (p) => {
    await p.fill('#rxPattern', '\\d+');
    await p.fill('#rxTestString', 'abc 123 def 456');
    await p.waitForTimeout(900);
    const t = await bodyText(p);
    return { ok: /match/i.test(t) && (t.includes('123') || t.includes('2')), detail: 'matched digits' };
  },
  'diff-checker': async (p) => {
    await p.fill('#diffOriginal', 'line one\nline two');
    await p.fill('#diffChanged', 'line one\nline TWO');
    await p.click('#btnDiffCompare'); await p.waitForTimeout(700);
    const t = await read(p, '#diffResult');
    return { ok: (t || '').includes('TWO'), detail: 'diff rendered with change highlighted' };
  },
  'csv-json-converter': async (p) => {
    await p.fill('#csvInput', 'a,b\n1,2');
    await p.click('#btnCsvConvert'); await p.waitForTimeout(500);
    const out = await read(p, '#csvJsonOutput');
    return { ok: (out || '').includes('"a"'), detail: 'CSV -> JSON' };
  },
  'color-converter': async (p) => {
    await p.fill('#colorInput', '#6C4CE0'); await p.waitForTimeout(600);
    const t = await bodyText(p);
    return { ok: /rgb/i.test(t) && /hsl/i.test(t), detail: 'hex -> rgb + hsl + contrast' };
  },
  'appsettings-validator': async (p) => {
    await p.fill('#asInput', '{"ConnectionStrings":{"Default":""},"A":1,"A":2}');
    await p.click('#btnAsValidate'); await p.waitForTimeout(600);
    const t = await read(p, '#asResult');
    return { ok: /duplicate/i.test(t || '') || /empty/i.test(t || ''), detail: 'flagged duplicate/empty' };
  },
  'connection-string-builder': async (p) => {
    await p.fill('#csServer', 'localhost');
    await p.fill('#csDatabase', 'TestDb');
    await p.click('#btnCsBuild'); await p.waitForTimeout(500);
    const out = await read(p, '#csOutput');
    return { ok: (out || '').includes('localhost') && (out || '').includes('TestDb'), detail: 'built connection string' };
  },
  'markdown-previewer': async (p) => {
    await p.fill('#mdInput', '# Heading\n\n**bold**'); await p.waitForTimeout(800);
    const fr = p.frames().find(f => f !== p.mainFrame());
    const html = fr ? await fr.evaluate(() => document.body.innerHTML) : '';
    return { ok: html.includes('<h1') && html.includes('<strong'), detail: 'rendered in sandboxed iframe' };
  },
  'qr-code-generator': async (p) => {
    await p.fill('#qrInput', 'https://toolsharp.dev'); await p.waitForTimeout(1000);
    const drawn = await p.evaluate(() => {
      const c = document.getElementById('qrCanvas');
      if (!c || !c.getContext) return false;
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let dark = 0; for (let i = 0; i < d.length; i += 4) if (d[i] < 128) dark++;
      return dark > 100;
    });
    return { ok: drawn, detail: 'QR modules painted to canvas' };
  },
  'share-pad': async (p) => {
    await p.fill('#plainInput', 'hello world');
    await p.click('#btnGenerate'); await p.waitForTimeout(900);
    // Offline-link mode is fully client-side; the 6-digit code mode needs
    // the live Vercel API, unavailable against a local dist build.
    const link = await read(p, '#offlineLink');
    const err = await read(p, '#shareError');
    return { ok: !!(link && link.includes('#')) || !!err, detail: link ? 'offline link generated' : 'code mode needs live API (expected locally)' };
  },
  'curl-converter': async (p) => {
    await p.fill('#curlInput', `curl -X POST 'https://api.example.com/v1/users' -H 'Content-Type: application/json' -d '{"name":"Ada"}'`);
    await p.click('#btnCurlConvert'); await p.waitForTimeout(400);
    const out = await p.textContent('#codeOutput');
    const ok = out.includes('HttpRequestMessage') && out.includes('HttpMethod.Post');
    return { ok, detail: 'C# generated by default' };
  },
};

async function run(BASE) {
  const browser = await chromium.launch();
  let pass = 0; const failures = [];
  for (const [slug, fn] of Object.entries(TESTS)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
    const jsErrors = [];
    page.on('pageerror', e => jsErrors.push(String(e).slice(0, 120)));
    try {
      await page.goto(`${BASE}/tools/${slug}`, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const r = await fn(page);
      const je = jsErrors.length ? ` [JS ERR: ${jsErrors.join('|')}]` : '';
      if (r.ok && !jsErrors.length) { pass++; console.log(`PASS  ${slug.padEnd(27)} ${r.detail}`); }
      else { failures.push(slug); console.log(`FAIL  ${slug.padEnd(27)} ${r.detail}${je}`); }
    } catch (e) {
      failures.push(slug);
      console.log(`ERROR ${slug.padEnd(27)} ${String(e).split('\n')[0].slice(0, 100)}`);
    }
    await page.close();
  }
  await browser.close();
  console.log(`=== tools: ${pass}/${Object.keys(TESTS).length} working ===`);
  if (failures.length) console.log('needs attention: ' + failures.join(', '));
  return failures.length === 0;
}

module.exports = { run };
