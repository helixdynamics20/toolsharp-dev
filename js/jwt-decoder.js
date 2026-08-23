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

  // Verify Signature if Secret is provided and algorithm is HS256
  const secretKey = document.getElementById('jwtSecret').value;
  if (secretKey) {
    verifyResult.style.display = 'block';
    if (header.alg !== 'HS256') {
      verifyResult.className = 'callout warn';
      verifyResult.innerHTML = `Verification only supported for HS256 algorithm. Current token uses: <strong>${escapeHtml(header.alg)}</strong>`;
      return;
    }

    try {
      const isVerified = await verifyHS256(parts[0], parts[1], parts[2], secretKey);
      if (isVerified) {
        verifyResult.className = 'callout ok';
        verifyResult.innerHTML = '✔ Signature Verified (HS256)';
      } else {
        verifyResult.className = 'callout error';
        verifyResult.innerHTML = '✖ Invalid Signature';
      }
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
  
  // Re-encode signatureB64 from URL-safe Base64
  let sigStr = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  while (sigStr.length % 4) sigStr += '=';
  const sigBytes = new Uint8Array(atob(sigStr).split('').map(c => c.charCodeAt(0)));

  const dataBytes = enc.encode(`${headerB64}.${payloadB64}`);
  return await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function copyJson(id, btn) { navigator.clipboard.writeText(document.getElementById(id).textContent); flashCopied(btn); }
