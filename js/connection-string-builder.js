function toggleCreds() {
  const auth = document.getElementById('csAuth').value;
  document.getElementById('csCreds').style.display = (auth === 'sql' || auth === 'azuread-password') ? 'grid' : 'none';
}
document.getElementById('csAuth').addEventListener('change', toggleCreds);

// Remember the auth type + flag preferences (not the server/credentials --
// those are per-connection, not a personal default worth persisting).
persistFormState('connection-string-builder', ['csAuth', 'csEncrypt', 'csTrust', 'csMars']);
toggleCreds();

function clearCsForm() {
  ['csServer','csDatabase','csUser','csPass','csAppName','csTimeout'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('csAuth').value = 'sql';
  document.getElementById('csEncrypt').checked = true;
  document.getElementById('csTrust').checked = false;
  document.getElementById('csMars').checked = false;
  document.getElementById('csOutput').textContent = 'Fill in the fields on the left, then click "Build string".';
  document.getElementById('csOutput').classList.add('empty');
  document.getElementById('csWarnings').innerHTML = '';
  toggleCreds();
}

function buildConnectionString() {
  const server = document.getElementById('csServer').value.trim();
  const db = document.getElementById('csDatabase').value.trim();
  const auth = document.getElementById('csAuth').value;
  const user = document.getElementById('csUser').value.trim();
  const pass = document.getElementById('csPass').value;
  const encrypt = document.getElementById('csEncrypt').checked;
  const trust = document.getElementById('csTrust').checked;
  const mars = document.getElementById('csMars').checked;
  const timeout = document.getElementById('csTimeout').value.trim();
  const appName = document.getElementById('csAppName').value.trim();

  let parts = [];
  if (server) {
    const isNamedInstance = server.includes('\\');
    parts.push(isNamedInstance ? `Server=${server}` : `Server=tcp:${server},1433`);
  }
  if (db) parts.push(`Database=${db}`);

  if (auth === 'sql') {
    if (user) parts.push(`User Id=${user}`);
    if (pass) parts.push(`Password=${pass}`);
  } else if (auth === 'windows') {
    parts.push('Integrated Security=True');
  } else if (auth === 'azuread-default') {
    parts.push('Authentication=Active Directory Default');
  } else if (auth === 'azuread-interactive') {
    parts.push('Authentication=Active Directory Interactive');
  } else if (auth === 'azuread-password') {
    parts.push('Authentication=Active Directory Password');
    if (user) parts.push(`User Id=${user}`);
    if (pass) parts.push(`Password=${pass}`);
  }

  parts.push(`Encrypt=${encrypt ? 'True' : 'False'}`);
  if (trust) parts.push('TrustServerCertificate=True');
  if (mars) parts.push('MultipleActiveResultSets=True');
  if (timeout) parts.push(`Connect Timeout=${timeout}`);
  if (appName) parts.push(`Application Name=${appName}`);

  const result = parts.join(';') + ';';
  const out = document.getElementById('csOutput');
  out.innerHTML = highlightConnString(result);
  out.classList.remove('empty');

  let warnings = [];
  const isAzure = server.includes('database.windows.net');
  if (isAzure && !encrypt) {
    warnings.push({type:'error', msg: 'Server looks like Azure SQL, but Encrypt is off — Azure SQL will reject this connection.'});
  }
  if (trust && isAzure) {
    warnings.push({type:'warn', msg: 'TrustServerCertificate=True on what looks like an Azure SQL host — usually unnecessary and worth double-checking before this reaches production.'});
  }
  if (auth === 'windows' && (user || pass)) {
    warnings.push({type:'warn', msg: 'Integrated Security is set but User Id/Password are also filled in — the credentials will be ignored.'});
  }
  if (!server) warnings.push({type:'warn', msg: 'No server specified yet.'});

  document.getElementById('csWarnings').innerHTML = warnings.map(w =>
    `<div class="callout ${w.type}">${w.msg}</div>`
  ).join('');
}

function parseConnectionString() {
  const input = document.getElementById('csParseInput').value.trim();
  const resultDiv = document.getElementById('csParsedResult');
  if (!input) { resultDiv.innerHTML = ''; return; }

  const pairs = input.split(';').map(p => p.trim()).filter(Boolean);
  let rows = [];
  pairs.forEach(p => {
    const idx = p.indexOf('=');
    if (idx === -1) return;
    const key = p.substring(0, idx).trim();
    let val = p.substring(idx + 1).trim();
    if (/password|pwd/i.test(key)) val = '••••••• (hidden)';
    rows.push({key, val});
  });

  if (rows.length === 0) {
    resultDiv.innerHTML = '<div class="callout error" style="margin-top:14px;">Could not parse any key=value pairs. Check the format looks like Key=Value;Key=Value;</div>';
    return;
  }

  resultDiv.innerHTML = `
    <div class="config-block" style="margin-top:18px;">
      <div class="tab">parsed fields</div>
      <div class="result-list">
        ${rows.map(r => `<div class="result-item"><span class="k">${escapeHtml(r.key)}</span><span class="v${/password|pwd/i.test(r.key) ? ' secret' : ''}">${escapeHtml(r.val)}</span></div>`).join('')}
      </div>
    </div>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function highlightConnString(str) {
  return str.split(';').filter(Boolean).map(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return escapeHtml(part);
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    const isSecret = /password|pwd/i.test(key);
    return `<span class="cs-key">${escapeHtml(key)}</span><span class="cs-eq">=</span><span class="${isSecret ? 'cs-val-secret' : 'cs-val'}">${escapeHtml(val)}</span>`;
  }).join('<span class="cs-sep">;</span>') + '<span class="cs-sep">;</span>';
}

