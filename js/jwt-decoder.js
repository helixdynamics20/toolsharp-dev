function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  const decoded = atob(str);
  try {
    return decodeURIComponent(decoded.split('').map(c =>
      '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
  } catch (e) {
    return decoded;
  }
}

function formatTs(ts) {
  const d = new Date(ts * 1000);
  return `${d.toISOString()} (${d.toString()})`;
}

async function decodeJwt() {
  const input = document.getElementById('jwtInput').value.trim();
  const resultDiv = document.getElementById('jwtResult');
  const verifyResult = document.getElementById('verifyResult');
  if (!input) { resultDiv.innerHTML = ''; verifyResult.style.display = 'none'; return; }

  const parts = input.split('.');
  if (parts.length < 2) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">That doesn't look like a JWT — expected three dot-separated segments (header.payload.signature), found ${parts.length}.</div>`;
    verifyResult.style.display = 'none';
    return;
  }

  let header, payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
  } catch (e) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">Couldn't parse the header segment as JSON. Check the token was copied in full.</div>`;
    verifyResult.style.display = 'none';
    return;
  }
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (e) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">Couldn't parse the payload segment as JSON. Check the token was copied in full.</div>`;
    verifyResult.style.display = 'none';
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  let timeCallouts = '';
  if (payload.exp) {
    const expired = payload.exp < now;
    timeCallouts += `<div class="callout ${expired ? 'error' : 'ok'}">exp: ${formatTs(payload.exp)} — ${expired ? 'expired' : 'valid'} ${expired ? '(' + Math.round((now - payload.exp)/60) + ' min ago)' : '(' + Math.round((payload.exp - now)/60) + ' min from now)'}</div>`;
  }
  if (payload.nbf) {
    const notYetValid = payload.nbf > now;
    timeCallouts += `<div class="callout ${notYetValid ? 'warn' : 'ok'}">nbf: ${formatTs(payload.nbf)} — ${notYetValid ? 'not valid yet' : 'already active'}</div>`;
  }
  if (payload.iat) {
    timeCallouts += `<div class="callout ok">iat (issued at): ${formatTs(payload.iat)}</div>`;
  }

  resultDiv.innerHTML = `
    <div class="tool-grid" style="margin-top:20px;">
      <div class="config-block">
        <div class="tab">header <button class="copy-btn" onclick="copyJson('jwtHeaderOut', this)">copy</button></div>
        <div class="output-block"><pre id="jwtHeaderOut">${escapeHtml(JSON.stringify(header, null, 2))}</pre></div>
      </div>
      <div class="config-block">
        <div class="tab">payload <button class="copy-btn" onclick="copyJson('jwtPayloadOut', this)">copy</button></div>
        <div class="output-block"><pre id="jwtPayloadOut">${escapeHtml(JSON.stringify(payload, null, 2))}</pre></div>
      </div>
    </div>
    ${timeCallouts ? '<div style="margin-top:6px;">' + timeCallouts + '</div>' : ''}
  `;

  // Signature verification
  const algSel = document.getElementById('jwtAlgSelect');
  const selectedAlg = algSel ? algSel.value : 'HS256';
  const secretKey = document.getElementById('jwtSecret').value.trim();
  const pemKey = document.getElementById('jwtPem') ? document.getElementById('jwtPem').value.trim() : '';

  const hasInput = selectedAlg === 'HS256' ? !!secretKey : !!pemKey;
  if (hasInput) {
    verifyResult.style.display = 'block';
    const tokenAlg = header.alg || '';
    if (tokenAlg && tokenAlg !== selectedAlg) {
      verifyResult.className = 'callout warn';
      verifyResult.innerHTML = `Token header says <strong>${escapeHtml(tokenAlg)}</strong> but you selected <strong>${escapeHtml(selectedAlg)}</strong> — switch the selector to match.`;
      return;
    }
    try {
      let ok;
      if (selectedAlg === 'HS256') {
        ok = await verifyHS256(parts[0], parts[1], parts[2], secretKey);
      } else if (selectedAlg === 'RS256') {
        ok = await verifyRS256(parts[0], parts[1], parts[2], pemKey);
      } else if (selectedAlg === 'ES256') {
        ok = await verifyES256(parts[0], parts[1], parts[2], pemKey);
      }
      verifyResult.className = `callout ${ok ? 'ok' : 'error'}`;
      verifyResult.innerHTML = ok
        ? `✔ Signature verified (${selectedAlg})`
        : `✖ Signature invalid (${selectedAlg})`;
    } catch (err) {
      verifyResult.className = 'callout error';
      verifyResult.innerHTML = `Verification error: ${escapeHtml(err.message)}`;
    }
  } else {
    verifyResult.style.display = 'none';
  }
}

async function verifyHS256(headerB64, payloadB64, signatureB64, secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  let sigStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  while (sigStr.length % 4) sigStr += '=';
  const sigBytes = new Uint8Array(atob(sigStr).split('').map(c => c.charCodeAt(0)));
  const dataBytes = enc.encode(`${headerB64}.${payloadB64}`);
  return await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
}

function pemToDer(pem) {
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s/g, '');
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

function sigToBytes(b64url) {
  let s = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return new Uint8Array(atob(s).split('').map(c => c.charCodeAt(0)));
}

async function verifyRS256(headerB64, payloadB64, sigB64, pem) {
  const der = pemToDer(pem);
  const key = await crypto.subtle.importKey(
    'spki', der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['verify']
  );
  const sig = sigToBytes(sigB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, data);
}

async function verifyES256(headerB64, payloadB64, sigB64, pem) {
  const der = pemToDer(pem);
  const key = await crypto.subtle.importKey(
    'spki', der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false, ['verify']
  );
  const sig = sigToBytes(sigB64);
  const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, sig, data);
}

function onAlgChange() {
  const alg = document.getElementById('jwtAlgSelect').value;
  document.getElementById('jwtSecretRow').style.display = alg === 'HS256' ? '' : 'none';
  document.getElementById('jwtPemRow').style.display = alg !== 'HS256' ? '' : 'none';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function copyJson(id, btn) { navigator.clipboard.writeText(document.getElementById(id).textContent); flashCopied(btn); }
