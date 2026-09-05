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

function tryCsExample() {
  document.getElementById('csServer').value = 'myserver.database.windows.net';
  document.getElementById('csDatabase').value = 'StoredValueDb';
  document.getElementById('csAuth').value = 'sql';
  document.getElementById('csUser').value = 'app_user';
  document.getElementById('csPass').value = 'ExamplePassword123!';
  document.getElementById('csEncrypt').checked = true;
  document.getElementById('csTrust').checked = false;
  document.getElementById('csMars').checked = false;
  document.getElementById('csTimeout').value = '30';
  document.getElementById('csAppName').value = 'StoredValue.Api';
  toggleCreds();
  buildConnectionString();
}

// ADO.NET connection string value escaping: a value containing ; = ' " or
// leading/trailing whitespace must be quoted or it silently truncates the
// value at the special character and corrupts the rest of the string.
// Prefer single quotes; switch to double quotes (doubling any embedded
// double quotes) when the value itself contains a single quote.
function escapeCsValue(val) {
  if (!/[;='"]/.test(val) && val === val.trim()) return val;
  if (!val.includes("'")) return `'${val}'`;
  return `"${val.replace(/"/g, '""')}"`;
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
    // a server value pasted from somewhere that already specifies a port
    // (e.g. "myserver.database.windows.net,3342") shouldn't also get the
    // default ",1433" appended, or the port ends up doubled/malformed.
    const hasExplicitPort = /,\s*\d+\s*$/.test(server);
    let serverValue;
    if (isNamedInstance) serverValue = server;
    else if (hasExplicitPort) serverValue = `tcp:${server}`;
    else serverValue = `tcp:${server},1433`;
    parts.push(`Server=${escapeCsValue(serverValue)}`);
  }
  if (db) parts.push(`Database=${escapeCsValue(db)}`);

  if (auth === 'sql') {
    if (user) parts.push(`User Id=${escapeCsValue(user)}`);
    if (pass) parts.push(`Password=${escapeCsValue(pass)}`);
  } else if (auth === 'windows') {
    parts.push('Integrated Security=True');
  } else if (auth === 'azuread-default') {
    parts.push('Authentication=Active Directory Default');
  } else if (auth === 'azuread-interactive') {
    parts.push('Authentication=Active Directory Interactive');
  } else if (auth === 'azuread-password') {
    parts.push('Authentication=Active Directory Password');
    if (user) parts.push(`User Id=${escapeCsValue(user)}`);
    if (pass) parts.push(`Password=${escapeCsValue(pass)}`);
  }

  parts.push(`Encrypt=${encrypt ? 'True' : 'False'}`);
  if (trust) parts.push('TrustServerCertificate=True');
  if (mars) parts.push('MultipleActiveResultSets=True');
  if (timeout) parts.push(`Connect Timeout=${escapeCsValue(timeout)}`);
  if (appName) parts.push(`Application Name=${escapeCsValue(appName)}`);

  const out = document.getElementById('csOutput');
  out.innerHTML = highlightConnString(parts);
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

// Splits "Key=Value;Key=Value;..." the way ADO.NET actually does: a value
// can be wrapped in ' or " (escapeCsValue above does exactly this for any
// value containing ; = ' " or leading/trailing whitespace), and a ; or =
// *inside* a quoted value is literal data, not a separator. Naively
// splitting on every ; -- what this used to do -- silently truncated or
// dropped any value that needed quoting, which is exactly the class of
// value this tool's own Build side produces.
function splitConnStringPairs(input) {
  const pairs = [];
  const n = input.length;
  let i = 0;
  while (i < n) {
    while (i < n && (input[i] === ';' || /\s/.test(input[i]))) i++;
    if (i >= n) break;
    const keyStart = i;
    while (i < n && input[i] !== '=' && input[i] !== ';') i++;
    if (i >= n || input[i] !== '=') { while (i < n && input[i] !== ';') i++; continue; }
    const key = input.slice(keyStart, i).trim();
    i++; // skip '='
    while (i < n && input[i] === ' ') i++;

    let val;
    if (input[i] === "'" || input[i] === '"') {
      const quote = input[i];
      i++;
      let out = '';
      while (i < n) {
        if (input[i] === quote) {
          if (input[i + 1] === quote) { out += quote; i += 2; continue; }
          i++; break;
        }
        out += input[i]; i++;
      }
      val = out;
      while (i < n && input[i] !== ';') i++; // trailing junk before the next ';', if any
    } else {
      const valStart = i;
      while (i < n && input[i] !== ';') i++;
      val = input.slice(valStart, i).trim();
    }
    pairs.push({ key, val });
  }
  return pairs;
}

function parseConnectionString() {
  const input = document.getElementById('csParseInput').value.trim();
  const resultDiv = document.getElementById('csParsedResult');
  if (!input) { resultDiv.innerHTML = ''; return; }

  let rows = splitConnStringPairs(input).map(({ key, val }) => ({
    key,
    val: /password|pwd/i.test(key) ? '••••••• (hidden)' : val,
  }));

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

// Takes the same "Key=EscapedValue" segments buildConnectionString() is
// about to join with ';', instead of re-splitting the joined string on ';'
// -- an escaped value can itself contain a literal ';' (that's the whole
// reason escapeCsValue quotes it), and re-splitting on ';' broke that
// value's boundary and highlighted a fake extra field in the middle of it.
function highlightConnString(parts) {
  return parts.map(part => {
    const idx = part.indexOf('=');
    if (idx === -1) return escapeHtml(part);
    const key = part.slice(0, idx);
    const val = part.slice(idx + 1);
    const isSecret = /password|pwd/i.test(key);
    return `<span class="cs-key">${escapeHtml(key)}</span><span class="cs-eq">=</span><span class="${isSecret ? 'cs-val-secret' : 'cs-val'}">${escapeHtml(val)}</span>`;
  }).join('<span class="cs-sep">;</span>') + '<span class="cs-sep">;</span>';
}


document.getElementById('btnCsBuild').addEventListener('click', buildConnectionString);
document.getElementById('btnCsExample').addEventListener('click', tryCsExample);
document.getElementById('btnCsClear').addEventListener('click', clearCsForm);
document.getElementById('btnCsParse').addEventListener('click', parseConnectionString);
