/* curl-to-csharp.js — ToolSharp.dev */
'use strict';

/* Shell-aware tokenizer: handles single quotes (fully literal), double
   quotes (backslash escapes \\ \" \$ \`), unquoted backslash-escapes, and
   adjacent quoted/unquoted segments concatenating into one token -- the
   same rules a real shell applies, which matters because "Copy as cURL"
   from browser devtools relies on exactly this quoting. */
function tokenizeShell(cmd) {
  const tokens = [];
  let i = 0;
  const n = cmd.length;
  while (i < n) {
    while (i < n && /\s/.test(cmd[i])) i++;
    if (i >= n) break;
    let token = '';
    while (i < n && !/\s/.test(cmd[i])) {
      const ch = cmd[i];
      if (ch === "'") {
        i++;
        while (i < n && cmd[i] !== "'") { token += cmd[i]; i++; }
        i++;
      } else if (ch === '"') {
        i++;
        while (i < n && cmd[i] !== '"') {
          if (cmd[i] === '\\' && i + 1 < n && '"\\$`'.includes(cmd[i + 1])) {
            token += cmd[i + 1]; i += 2;
          } else { token += cmd[i]; i++; }
        }
        i++;
      } else if (ch === '\\' && i + 1 < n) {
        token += cmd[i + 1]; i += 2;
      } else {
        token += ch; i++;
      }
    }
    tokens.push(token);
  }
  return tokens;
}

// Flags that take no value -- safe to skip without consuming the next token.
const NOOP_FLAGS = new Set([
  '-s', '--silent', '-v', '--verbose', '-i', '--include', '-L', '--location',
  '--compressed', '-#', '--progress-bar', '-f', '--fail', '-sS', '-fsSL',
  '--http1.1', '--http2', '-4', '--ipv4', '-6', '--ipv6', '-n', '--netrc'
]);

function parseCurl(input) {
  let cmd = (input || '').trim();
  if (!cmd) throw new Error('Paste a curl command first.');
  // Line continuations ("\" at end of line) joined before tokenizing -- the
  // common case for multi-line curl commands copied from docs/devtools.
  cmd = cmd.replace(/\\\r?\n/g, ' ');
  if (!/^curl\b/.test(cmd.trim())) {
    throw new Error("Doesn't look like a curl command -- expected it to start with \"curl\".");
  }

  const tokens = tokenizeShell(cmd);
  tokens.shift(); // drop leading "curl"

  const req = {
    method: null, url: null, headers: [], dataParts: [], user: null,
    insecure: false, isGet: false, formParts: [],
  };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (NOOP_FLAGS.has(t)) continue;
    switch (t) {
      case '-X': case '--request': req.method = tokens[++i]; break;
      case '-H': case '--header': if (tokens[i + 1] !== undefined) req.headers.push(tokens[++i]); break;
      case '-d': case '--data': case '--data-raw': case '--data-binary': case '--data-ascii':
        if (tokens[i + 1] !== undefined) req.dataParts.push(tokens[++i]); break;
      case '--data-urlencode': {
        const val = tokens[++i] || '';
        const eq = val.indexOf('=');
        req.dataParts.push(eq === -1 ? encodeURIComponent(val) : val.slice(0, eq) + '=' + encodeURIComponent(val.slice(eq + 1)));
        break;
      }
      case '-F': case '--form': if (tokens[i + 1] !== undefined) req.formParts.push(tokens[++i]); break;
      case '-u': case '--user': req.user = tokens[++i]; break;
      case '-A': case '--user-agent': req.headers.push('User-Agent: ' + tokens[++i]); break;
      case '-b': case '--cookie': req.headers.push('Cookie: ' + tokens[++i]); break;
      case '-e': case '--referer': req.headers.push('Referer: ' + tokens[++i]); break;
      case '-k': case '--insecure': req.insecure = true; break;
      case '-G': case '--get': req.isGet = true; break;
      case '--url': req.url = tokens[++i]; break;
      case '-o': case '--output': case '-w': case '--write-out': case '--connect-timeout':
      case '-m': case '--max-time': case '--retry': case '--cert': case '--key': case '-x': case '--proxy':
        i++; break; // known arg-taking flags we don't translate -- skip their value, don't misparse it as the URL
      default:
        if (!t.startsWith('-') && !req.url) req.url = t;
        break;
    }
  }
  if (!req.url) throw new Error("Couldn't find a URL in that command.");
  return req;
}

function csEscape(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

function parseHeaderLine(h) {
  const idx = h.indexOf(':');
  if (idx === -1) return [h.trim(), ''];
  return [h.slice(0, idx).trim(), h.slice(idx + 1).trim()];
}

const METHOD_MAP = {
  GET: 'HttpMethod.Get', POST: 'HttpMethod.Post', PUT: 'HttpMethod.Put',
  DELETE: 'HttpMethod.Delete', PATCH: 'HttpMethod.Patch', HEAD: 'HttpMethod.Head',
  OPTIONS: 'HttpMethod.Options',
};

function generateCSharp(req) {
  let url = req.url;
  let body = req.dataParts.length ? req.dataParts.join('&') : null;
  let method = (req.method || (body ? 'POST' : 'GET')).toUpperCase();

  if (req.isGet && body) {
    url += (url.includes('?') ? '&' : '?') + body;
    body = null;
    method = 'GET';
  }

  const headerPairs = req.headers.map(parseHeaderLine);
  let contentType = null;
  const requestHeaders = [];
  for (const [name, value] of headerPairs) {
    if (/^content-type$/i.test(name)) contentType = value;
    else requestHeaders.push([name, value]);
  }

  const needsEncoding = !!(body || req.user);
  const lines = [];
  lines.push('using System;');
  lines.push('using System.Net.Http;');
  lines.push('using System.Net.Http.Headers;');
  if (needsEncoding) lines.push('using System.Text;');
  lines.push('');

  if (req.formParts.length) {
    lines.push('// -F / --form (multipart) was in the curl command -- multipart bodies need');
    lines.push('// MultipartFormDataContent built by hand, so it isn\'t auto-converted. Original fields:');
    req.formParts.forEach(f => lines.push('//   -F "' + f.replace(/\*\//g, '*\\/') + '"'));
    lines.push('');
  }

  if (req.insecure) {
    lines.push('// -k / --insecure was present -- this disables TLS certificate validation');
    lines.push('// entirely. Only ever do this against a known-safe dev/test endpoint.');
    lines.push('var handler = new HttpClientHandler {');
    lines.push('    ServerCertificateCustomValidationCallback = HttpClientHandler.DangerousAcceptAnyServerCertificateValidator');
    lines.push('};');
    lines.push('using var client = new HttpClient(handler);');
  } else {
    lines.push('using var client = new HttpClient();');
  }
  lines.push('');

  const methodExpr = METHOD_MAP[method] || `new HttpMethod("${method}")`;
  lines.push(`var request = new HttpRequestMessage(${methodExpr}, "${csEscape(url)}");`);

  if (req.user) {
    const idx = req.user.indexOf(':');
    const userPart = idx === -1 ? req.user : req.user.slice(0, idx);
    const passPart = idx === -1 ? '' : req.user.slice(idx + 1);
    lines.push('request.Headers.Authorization = new AuthenticationHeaderValue("Basic",');
    lines.push(`    Convert.ToBase64String(Encoding.UTF8.GetBytes("${csEscape(userPart)}:${csEscape(passPart)}")));`);
  }

  for (const [name, value] of requestHeaders) {
    lines.push(`request.Headers.TryAddWithoutValidation("${csEscape(name)}", "${csEscape(value)}");`);
  }

  if (body) {
    const mediaType = contentType ? contentType.split(';')[0].trim() : 'application/x-www-form-urlencoded';
    lines.push(`request.Content = new StringContent("${csEscape(body)}", Encoding.UTF8, "${csEscape(mediaType)}");`);
  }

  lines.push('');
  lines.push('var response = await client.SendAsync(request);');
  lines.push('response.EnsureSuccessStatusCode();');
  lines.push('var responseBody = await response.Content.ReadAsStringAsync();');

  return lines.join('\n');
}

function convert() {
  const input = document.getElementById('curlInput').value;
  const out = document.getElementById('csharpOutput');
  const errEl = document.getElementById('curlError');
  try {
    const req = parseCurl(input);
    out.value = generateCSharp(req);
    errEl.style.display = 'none';
  } catch (e) {
    out.value = '';
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function tryExample() {
  document.getElementById('curlInput').value =
    `curl 'https://api.example.com/v1/users' \\\n` +
    `  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc.def' \\\n` +
    `  -H 'Content-Type: application/json' \\\n` +
    `  --data-raw '{"name":"Ada Lovelace","role":"admin"}'`;
  convert();
}

function clearAll() {
  document.getElementById('curlInput').value = '';
  document.getElementById('csharpOutput').value = '';
  document.getElementById('curlError').style.display = 'none';
}

document.getElementById('btnCurlConvert').addEventListener('click', convert);
document.getElementById('btnCurlExample').addEventListener('click', tryExample);
document.getElementById('btnCurlClear').addEventListener('click', clearAll);
document.getElementById('curlInput').addEventListener('input', () => {
  clearTimeout(window.__curlDebounce);
  window.__curlDebounce = setTimeout(convert, 400);
});
