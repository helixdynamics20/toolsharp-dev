function newGuid() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function generateGuid() {
  const d = newGuid();
  document.getElementById('guidInput').value = d;
  renderGuid(d);
}

function generateBulkGuids() {
  const countEl = document.getElementById('guidBulkCount');
  let n = parseInt(countEl.value, 10) || 1;
  n = Math.min(Math.max(n, 1), 100);
  if (String(n) !== countEl.value) countEl.value = n;
  const guids = Array.from({ length: n }, () => newGuid());
  document.getElementById('guidBulkOutput').value = guids.join('\n');
}

function onGuidInput() {
  const raw = document.getElementById('guidInput').value.trim();
  if (!raw) { document.getElementById('guidResult').innerHTML = ''; return; }
  renderGuid(raw);
}

function normalizeGuid(raw) {
  const cleaned = raw.replace(/[{}()]/g, '').trim();
  const hexOnly = cleaned.replace(/-/g, '');
  if (!/^[0-9a-fA-F]{32}$/.test(hexOnly)) return null;
  const h = hexOnly.toLowerCase();
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}

function renderGuid(raw) {
  const resultDiv = document.getElementById('guidResult');
  const d = normalizeGuid(raw);
  if (!d) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">That doesn't look like a valid GUID — expected 32 hex digits, with or without dashes/braces/parens.</div>`;
    return;
  }
  const n = d.replace(/-/g, '');
  const b = `{${d}}`;
  const p = `(${d})`;

  const seg = d.split('-');
  const tailHex = seg[3] + seg[4];
  const bytePairs = [];
  for (let i = 0; i < 16; i += 2) bytePairs.push('0x' + tailHex.substring(i, i + 2));
  const x = `{0x${seg[0]},0x${seg[1]},0x${seg[2]},{${bytePairs.join(',')}}}`;

  const rows = [
    {k: 'D  (default)', v: d},
    {k: 'N  (no dashes)', v: n},
    {k: 'B  (braces)', v: b},
    {k: 'P  (parens)', v: p},
    {k: 'X  (ctor form)', v: x},
  ];

  resultDiv.innerHTML = `
    <div class="config-block" style="margin-top:20px;">
      <div class="tab">formats</div>
      <div class="result-list">
        ${rows.map((r,i) => `<div class="result-item"><span class="k">${r.k}</span><span class="v" id="guidRow${i}">${escapeHtml(r.v)}</span></div>`).join('')}
      </div>
      <div class="body" style="padding-top:0;">
        <div class="btn-row">
          ${rows.map((r,i) => `<button class="btn secondary" onclick="copyElementValue('guidRow${i}', this)">copy ${r.k.trim().split(' ')[0]}</button>`).join('')}
        </div>
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

generateGuid();
