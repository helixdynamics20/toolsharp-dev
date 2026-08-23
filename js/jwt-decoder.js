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

function decodeJwt() {
  const input = document.getElementById('jwtInput').value.trim();
  const resultDiv = document.getElementById('jwtResult');
  if (!input) { resultDiv.innerHTML = ''; return; }

  const parts = input.split('.');
  if (parts.length < 2) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">That doesn't look like a JWT — expected three dot-separated segments (header.payload.signature), found ${parts.length}.</div>`;
    return;
  }

  let header, payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]));
  } catch (e) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">Couldn't parse the header segment as JSON. Check the token was copied in full.</div>`;
    return;
  }
  try {
    payload = JSON.parse(base64UrlDecode(parts[1]));
  } catch (e) {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:20px;">Couldn't parse the payload segment as JSON. Check the token was copied in full.</div>`;
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
    <div class="callout warn" style="margin-top:14px;">Signature not verified — this tool only decodes. A well-formed decode does not mean the token is authentic.</div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function copyJson(id, btn) { navigator.clipboard.writeText(document.getElementById(id).textContent); flashCopied(btn); }
