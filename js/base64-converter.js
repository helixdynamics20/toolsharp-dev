function toUrlSafe(b64) {
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromUrlSafe(b64) {
  let s = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return s;
}

function encodeB64() {
  const text = document.getElementById('b64Input').value;
  const output = document.getElementById('b64Output');
  const meta = document.getElementById('b64Meta');
  if (!text) {
    output.textContent = 'Nothing to encode — type or paste some text first.';
    output.classList.add('empty');
    meta.innerHTML = '';
    return;
  }
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => binary += String.fromCharCode(b));
    let b64 = btoa(binary);
    if (document.getElementById('b64UrlSafe').checked) b64 = toUrlSafe(b64);
    output.textContent = b64;
    output.classList.remove('empty');
    meta.innerHTML = `<div class="callout ok">Encoded ${bytes.length} byte(s) of UTF-8 text.</div>`;
  } catch (e) {
    output.textContent = '';
    meta.innerHTML = `<div class="callout error">Couldn't encode: ${e.message}</div>`;
  }
}

function decodeB64() {
  const raw = document.getElementById('b64Input').value.trim();
  const output = document.getElementById('b64Output');
  const meta = document.getElementById('b64Meta');
  if (!raw) {
    output.textContent = 'Nothing to decode — paste a Base64 string first.';
    output.classList.add('empty');
    meta.innerHTML = '';
    return;
  }
  try {
    const isUrlSafe = document.getElementById('b64UrlSafe').checked || (/[-_]/.test(raw) && !/[+/]/.test(raw));
    const normalized = isUrlSafe ? fromUrlSafe(raw) : raw;
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    output.textContent = text;
    output.classList.remove('empty');
    meta.innerHTML = `<div class="callout ok">Decoded ${bytes.length} byte(s).${isUrlSafe && !document.getElementById('b64UrlSafe').checked ? ' Auto-detected URL-safe encoding.' : ''}</div>`;
  } catch (e) {
    output.textContent = '';
    meta.innerHTML = `<div class="callout error">Couldn't decode — this doesn't look like valid Base64${document.getElementById('b64UrlSafe').checked ? '' : ' (try the URL-safe checkbox if this came from a JWT or URL)'}.</div>`;
  }
}

function clearB64() {
  document.getElementById('b64Input').value = '';
  const output = document.getElementById('b64Output');
  output.textContent = 'Result appears here.';
  output.classList.add('empty');
  document.getElementById('b64Meta').innerHTML = '';
}

function copyB64Out(btn) {
  navigator.clipboard.writeText(document.getElementById('b64Output').textContent);
  flashCopied(btn);
}
