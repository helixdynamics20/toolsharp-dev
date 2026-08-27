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

// Drag & Drop File Handling
function handleFileSelect(inputEl) {
  if (inputEl.files && inputEl.files[0]) {
    processFile(inputEl.files[0]);
  }
}

function processFile(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    // for a 0-byte file, split(',')[1] is '' (empty, not undefined) --
    // the old `|| e.target.result` fallback treated that falsy empty
    // string as "missing" and used the entire data URI as the result
    const parts = e.target.result.split(',');
    const rawB64 = parts.length > 1 ? parts[1] : e.target.result;
    let finalB64 = rawB64;
    if (document.getElementById('b64UrlSafe').checked) {
      finalB64 = toUrlSafe(rawB64);
    }
    const output = document.getElementById('b64Output');
    output.textContent = finalB64;
    output.classList.remove('empty');
    document.getElementById('b64Meta').innerHTML = `<div class="callout ok">Loaded and encoded file: <strong>${escapeHtml(file.name)}</strong> (${file.size} bytes).</div>`;
  };
  reader.readAsDataURL(file);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('load', function() {
  const dropZone = document.getElementById('dropZone');
  if (!dropZone) return;

  dropZone.addEventListener('click', () => document.getElementById('fileInput').click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--violet)';
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.style.borderColor = 'var(--rule)';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = 'var(--rule)';
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  });
});
