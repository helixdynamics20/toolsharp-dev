/* url-encoder.js — ToolSharp.dev */
'use strict';

let autoTimer = null;

/* ── encode / decode ── */

function encodeUrl() {
  const raw = document.getElementById('urlInput').value;
  const mode = getMode();
  let result = '';
  try {
    result = mode === 'full' ? encodeURI(raw) : encodeURIComponent(raw);
    showOutput(result, null);
  } catch (e) {
    showOutput('', e.message);
  }
}

function decodeUrl() {
  const raw = document.getElementById('urlInput').value;
  const mode = getMode();
  let result = '';
  try {
    result = mode === 'full' ? decodeURI(raw) : decodeURIComponent(raw);
    showOutput(result, null);
  } catch (e) {
    showOutput('', 'Invalid encoded string: ' + e.message);
  }
}

function getMode() {
  return document.getElementById('modeComponent').checked ? 'component' : 'full';
}

function showOutput(value, err) {
  const out = document.getElementById('urlOutput');
  const errEl = document.getElementById('urlError');
  out.value = value;
  errEl.textContent = err || '';
  errEl.style.display = err ? 'block' : 'none';
  updateCharCount(value);
}

function updateCharCount(val) {
  document.getElementById('urlCharCount').textContent =
    val ? `${val.length} chars` : '';
}

function swapInputOutput() {
  const inp = document.getElementById('urlInput');
  const out = document.getElementById('urlOutput');
  const tmp = inp.value;
  inp.value = out.value;
  out.value = tmp;
  updateCharCount(out.value);
  parseUrlLive();
}

function clearAll() {
  document.getElementById('urlInput').value = '';
  document.getElementById('urlOutput').value = '';
  document.getElementById('urlError').textContent = '';
  document.getElementById('urlError').style.display = 'none';
  document.getElementById('urlCharCount').textContent = '';
  document.getElementById('parseResult').innerHTML = '';
}

/* ── URL parser ── */

function parseUrlLive() {
  const raw = document.getElementById('urlInput').value.trim();
  const out = document.getElementById('parseResult');
  if (!raw) { out.innerHTML = ''; return; }

  let parsed;
  try {
    parsed = new URL(raw.includes('://') || raw.startsWith('//') ? raw : 'https://' + raw);
  } catch {
    out.innerHTML = '';
    return;
  }

  const params = [...parsed.searchParams.entries()];
  const paramRows = params.length
    ? params.map(([k, v]) => `
        <tr>
          <td class="pk"><code>${escHtml(k)}</code></td>
          <td class="pv"><code>${escHtml(v)}</code></td>
          <td class="pe"><code>${escHtml(encodeURIComponent(v))}</code></td>
        </tr>`).join('')
    : `<tr><td colspan="3" style="color:var(--ink-faint);font-style:italic;padding:8px 0;">no query parameters</td></tr>`;

  out.innerHTML = `
    <div class="parse-grid">
      <div class="parse-row"><span class="parse-key">protocol</span><code>${escHtml(parsed.protocol)}</code></div>
      <div class="parse-row"><span class="parse-key">host</span><code>${escHtml(parsed.host)}</code></div>
      ${parsed.port ? `<div class="parse-row"><span class="parse-key">port</span><code>${escHtml(parsed.port)}</code></div>` : ''}
      <div class="parse-row"><span class="parse-key">pathname</span><code>${escHtml(parsed.pathname)}</code></div>
      ${parsed.search ? `<div class="parse-row"><span class="parse-key">search</span><code>${escHtml(parsed.search)}</code></div>` : ''}
      ${parsed.hash ? `<div class="parse-row"><span class="parse-key">hash</span><code>${escHtml(parsed.hash)}</code></div>` : ''}
    </div>
    ${params.length ? `
    <div class="parse-params">
      <div class="parse-params-head">Query parameters</div>
      <table class="params-table">
        <thead><tr><th>key</th><th>value (decoded)</th><th>value (encoded)</th></tr></thead>
        <tbody>${paramRows}</tbody>
      </table>
    </div>` : ''}`;
}

/* ── URL builder ── */

function buildUrl() {
  const protocol = document.getElementById('buildProtocol').value.trim() || 'https';
  const host = document.getElementById('buildHost').value.trim();
  const path = document.getElementById('buildPath').value.trim();
  const hash = document.getElementById('buildHash').value.trim();

  if (!host) {
    document.getElementById('buildResult').innerHTML =
      '<div class="callout warn">Enter a host to build a URL.</div>';
    return;
  }

  let url;
  try {
    url = new URL(`${protocol}://${host}`);
    url.pathname = path.startsWith('/') ? path : '/' + path;

    const rows = document.querySelectorAll('#paramRows .param-row');
    rows.forEach(row => {
      const k = row.querySelector('.param-key').value.trim();
      const v = row.querySelector('.param-val').value.trim();
      if (k) url.searchParams.append(k, v);
    });

    if (hash) url.hash = hash.startsWith('#') ? hash : '#' + hash;
  } catch (e) {
    document.getElementById('buildResult').innerHTML =
      `<div class="callout error">${escHtml(e.message)}</div>`;
    return;
  }

  const final = url.toString();
  document.getElementById('buildResult').innerHTML = `
    <div class="config-block">
      <div class="tab">generated URL
        <button class="copy-btn" onclick="copyElementValue('builtUrl', this)">copy</button>
      </div>
      <div class="output-block">
        <pre id="builtUrl" style="white-space:pre-wrap;word-break:break-all;">${escHtml(final)}</pre>
      </div>
    </div>`;
}

function addParamRow() {
  const container = document.getElementById('paramRows');
  const row = document.createElement('div');
  row.className = 'param-row';
  row.innerHTML = `
    <input type="text" class="param-key" placeholder="key">
    <input type="text" class="param-val" placeholder="value (plain — will be encoded)">
    <button class="remove-param-btn" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(row);
}

/* ── auto detect & schedule ── */

function scheduleAuto() {
  clearTimeout(autoTimer);
  autoTimer = setTimeout(parseUrlLive, 300);
}

/* ── helpers ── */

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = String(str);
  return d.innerHTML;
}


/* ── init ── */

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('urlInput').addEventListener('input', scheduleAuto);
});
