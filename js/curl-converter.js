/* curl-converter.js — ToolSharp.dev */
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

const NOOP_FLAGS = new Set([
  '-s', '--silent', '-v', '--verbose', '-i', '--include', '-L', '--location',
  '--compressed', '-#', '--progress-bar', '-f', '--fail', '-sS', '-fsSL',
  '--http1.1', '--http2', '-4', '--ipv4', '-6', '--ipv6', '-n', '--netrc'
]);

function parseCurl(input) {
  let cmd = (input || '').trim();
  if (!cmd) throw new Error('Paste a curl command first.');
  cmd = cmd.replace(/\\\r?\n/g, ' ');
  if (!/^curl\b/.test(cmd.trim())) {
    throw new Error("Doesn't look like a curl command -- expected it to start with \"curl\".");
  }

  const tokens = tokenizeShell(cmd);
  tokens.shift();

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
        i++; break;
      default:
        if (!t.startsWith('-') && !req.url) req.url = t;
        break;
    }
  }
  if (!req.url) throw new Error("Couldn't find a URL in that command.");

  // Resolve -G/--get once, here, so every generator sees the same final
  // method/url/body regardless of which language it's about to render.
  req.method = (req.method || (req.dataParts.length ? 'POST' : 'GET')).toUpperCase();
  req.body = req.dataParts.length ? req.dataParts.join('&') : null;
  if (req.isGet && req.body) {
    req.url += (req.url.includes('?') ? '&' : '?') + req.body;
    req.body = null;
    req.method = 'GET';
  }
  const headerPairs = req.headers.map(parseHeaderLine);
  req.contentType = null;
  req.requestHeaders = [];
  for (const [name, value] of headerPairs) {
    if (/^content-type$/i.test(name)) req.contentType = value;
    else req.requestHeaders.push([name, value]);
  }
  req.mediaType = req.contentType ? req.contentType.split(';')[0].trim() : 'application/x-www-form-urlencoded';
  if (req.user) {
    const idx = req.user.indexOf(':');
    req.authUser = idx === -1 ? req.user : req.user.slice(0, idx);
    req.authPass = idx === -1 ? '' : req.user.slice(idx + 1);
  }
  return req;
}

function parseHeaderLine(h) {
  const idx = h.indexOf(':');
  if (idx === -1) return [h.trim(), ''];
  return [h.slice(0, idx).trim(), h.slice(idx + 1).trim()];
}

// C-family double-quoted string escaping -- shared by C#, Java, Go, JS/Node,
// and Python, whose double-quoted string literals all treat backslash as the
// escape character the same way.
function esc(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
    .replace(/\t/g, '\\t');
}

// PowerShell double-quoted strings use a backtick as the escape character,
// and $ triggers variable interpolation unless escaped -- neither of which
// the C-family escaper above accounts for.
function escPs(str) {
  return String(str)
    .replace(/`/g, '``')
    .replace(/"/g, '`"')
    .replace(/\$/g, '`$')
    .replace(/\r/g, '`r')
    .replace(/\n/g, '`n')
    .replace(/\t/g, '`t');
}

function formComment(req, prefix) {
  if (!req.formParts.length) return [];
  const lines = [prefix + ' -F / --form (multipart) was in the curl command -- multipart bodies need'];
  lines.push(prefix + ' building by hand in every language, so it isn\'t auto-converted. Original fields:');
  req.formParts.forEach(f => lines.push(prefix + '   -F "' + f + '"'));
  lines.push('');
  return lines;
}

// ---------------------------------------------------------------- C# ----

function generateCSharp(req) {
  const needsEncoding = !!(req.body || req.user);
  const lines = [];
  lines.push('using System;');
  lines.push('using System.Net.Http;');
  lines.push('using System.Net.Http.Headers;');
  if (needsEncoding) lines.push('using System.Text;');
  lines.push('');
  lines.push(...formComment(req, '//'));

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

  const methodMap = { GET: 'HttpMethod.Get', POST: 'HttpMethod.Post', PUT: 'HttpMethod.Put', DELETE: 'HttpMethod.Delete', PATCH: 'HttpMethod.Patch', HEAD: 'HttpMethod.Head', OPTIONS: 'HttpMethod.Options' };
  const methodExpr = methodMap[req.method] || `new HttpMethod("${req.method}")`;
  lines.push(`var request = new HttpRequestMessage(${methodExpr}, "${esc(req.url)}");`);

  if (req.user) {
    lines.push('request.Headers.Authorization = new AuthenticationHeaderValue("Basic",');
    lines.push(`    Convert.ToBase64String(Encoding.UTF8.GetBytes("${esc(req.authUser)}:${esc(req.authPass)}")));`);
  }
  for (const [name, value] of req.requestHeaders) {
    lines.push(`request.Headers.TryAddWithoutValidation("${esc(name)}", "${esc(value)}");`);
  }
  if (req.body) {
    lines.push(`request.Content = new StringContent("${esc(req.body)}", Encoding.UTF8, "${esc(req.mediaType)}");`);
  }
  lines.push('');
  lines.push('var response = await client.SendAsync(request);');
  lines.push('response.EnsureSuccessStatusCode();');
  lines.push('var responseBody = await response.Content.ReadAsStringAsync();');
  return lines.join('\n');
}

// ------------------------------------------------------------- Python ----

function generatePython(req) {
  const lines = ['import requests', ''];
  lines.push(...formComment(req, '#'));
  lines.push(`url = "${esc(req.url)}"`);

  if (req.requestHeaders.length || req.contentType) {
    lines.push('headers = {');
    if (req.contentType) lines.push(`    "Content-Type": "${esc(req.contentType)}",`);
    for (const [name, value] of req.requestHeaders) lines.push(`    "${esc(name)}": "${esc(value)}",`);
    lines.push('}');
  }
  if (req.body) lines.push(`data = "${esc(req.body)}"`);
  lines.push('');

  const kwargs = [];
  if (req.requestHeaders.length || req.contentType) kwargs.push('headers=headers');
  if (req.body) kwargs.push('data=data');
  if (req.user) kwargs.push(`auth=("${esc(req.authUser)}", "${esc(req.authPass)}")`);
  if (req.insecure) kwargs.push('verify=False');

  const methodFn = req.method.toLowerCase();
  const knownMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
  if (req.insecure) {
    lines.push('# -k / --insecure was present -- verify=False disables TLS certificate validation');
    lines.push('# entirely. Only ever do this against a known-safe dev/test endpoint. This also');
    lines.push('# raises an InsecureRequestWarning; see urllib3.disable_warnings() if that\'s noisy.');
  }
  if (knownMethods.has(methodFn)) {
    lines.push(`response = requests.${methodFn}(url${kwargs.length ? ', ' + kwargs.join(', ') : ''})`);
  } else {
    lines.push(`response = requests.request("${req.method}", url${kwargs.length ? ', ' + kwargs.join(', ') : ''})`);
  }
  lines.push('response.raise_for_status()');
  lines.push('print(response.text)');
  return lines.join('\n');
}

// --------------------------------------------------- JavaScript (fetch) ----

function generateFetch(req) {
  const lines = [];
  lines.push(...formComment(req, '//'));

  const hasHeaders = req.requestHeaders.length || req.contentType || req.user;
  if (hasHeaders) {
    lines.push('const headers = {');
    if (req.contentType) lines.push(`  "Content-Type": "${esc(req.contentType)}",`);
    for (const [name, value] of req.requestHeaders) lines.push(`  "${esc(name)}": "${esc(value)}",`);
    if (req.user) {
      lines.push('  // fetch has no built-in basic-auth option -- encode it into the header directly.');
      lines.push('  // btoa() is available in browsers and Node 18+; use Buffer.from(...).toString("base64") on older Node.');
      lines.push(`  "Authorization": "Basic " + btoa("${esc(req.authUser)}:${esc(req.authPass)}"),`);
    }
    lines.push('};');
    lines.push('');
  }

  if (req.insecure) {
    lines.push('// -k / --insecure was present -- fetch has no cross-environment option to skip TLS');
    lines.push('// verification. In Node, that\'s process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"');
    lines.push('// (process-wide, dangerous); browsers offer no way to do this at all.');
    lines.push('');
  }

  lines.push(`const response = await fetch("${esc(req.url)}", {`);
  lines.push(`  method: "${req.method}",`);
  if (hasHeaders) lines.push('  headers,');
  if (req.body) lines.push(`  body: "${esc(req.body)}",`);
  lines.push('});');
  lines.push('const data = await response.text();');
  return lines.join('\n');
}

// -------------------------------------------------- Node.js (axios) ----

function generateAxios(req) {
  const lines = [];
  if (req.insecure) lines.push("const https = require('https');");
  lines.push("const axios = require('axios');");
  lines.push('');
  lines.push(...formComment(req, '//'));

  const configLines = [];
  if (req.requestHeaders.length || req.contentType) {
    configLines.push('  headers: {');
    if (req.contentType) configLines.push(`    "Content-Type": "${esc(req.contentType)}",`);
    for (const [name, value] of req.requestHeaders) configLines.push(`    "${esc(name)}": "${esc(value)}",`);
    configLines.push('  },');
  }
  if (req.user) {
    configLines.push(`  auth: { username: "${esc(req.authUser)}", password: "${esc(req.authPass)}" },`);
  }
  if (req.insecure) {
    configLines.push('  // -k / --insecure was present -- this disables TLS certificate validation entirely.');
    configLines.push('  // Only ever do this against a known-safe dev/test endpoint.');
    configLines.push('  httpsAgent: new https.Agent({ rejectUnauthorized: false }),');
  }

  const methodFn = req.method.toLowerCase();
  const knownMethods = new Set(['get', 'post', 'put', 'delete', 'patch', 'head', 'options']);
  if (knownMethods.has(methodFn) && (methodFn === 'get' || methodFn === 'delete' || methodFn === 'head' || methodFn === 'options')) {
    lines.push(`const response = await axios.${methodFn}("${esc(req.url)}", {`);
    lines.push(...configLines);
    lines.push('});');
  } else if (knownMethods.has(methodFn)) {
    lines.push(`const response = await axios.${methodFn}("${esc(req.url)}", ${req.body ? `"${esc(req.body)}"` : 'null'}, {`);
    lines.push(...configLines);
    lines.push('});');
  } else {
    lines.push('const response = await axios({');
    lines.push(`  method: "${req.method}",`);
    lines.push(`  url: "${esc(req.url)}",`);
    if (req.body) lines.push(`  data: "${esc(req.body)}",`);
    lines.push(...configLines);
    lines.push('});');
  }
  lines.push('console.log(response.data);');
  return lines.join('\n');
}

// ------------------------------------------------------------ PowerShell ----

function generatePowerShell(req) {
  const lines = [];
  lines.push(...formComment(req, '#'));

  const hasHeaders = req.requestHeaders.length || req.contentType || req.user;
  if (hasHeaders) {
    lines.push('$headers = @{');
    if (req.contentType) lines.push(`    "Content-Type" = "${escPs(req.contentType)}"`);
    for (const [name, value] of req.requestHeaders) lines.push(`    "${escPs(name)}" = "${escPs(value)}"`);
    if (req.user) {
      lines.push('    # -u / --user was present -- Invoke-RestMethod\'s own -Credential expects a');
      lines.push('    # PSCredential object, so this builds the Basic header directly instead.');
      lines.push(`    "Authorization" = "Basic " + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes("${escPs(req.authUser)}:${escPs(req.authPass)}"))`);
    }
    lines.push('}');
  }
  if (req.body) lines.push(`$body = "${escPs(req.body)}"`);
  lines.push('');

  if (req.insecure) {
    lines.push('# -k / --insecure was present -- -SkipCertificateCheck disables TLS certificate');
    lines.push('# validation entirely (PowerShell 6+/pwsh only; Windows PowerShell 5.1 has no direct');
    lines.push('# equivalent). Only ever do this against a known-safe dev/test endpoint.');
  }

  const params = [`-Uri "${escPs(req.url)}"`, `-Method ${req.method.charAt(0) + req.method.slice(1).toLowerCase()}`];
  if (hasHeaders) params.push('-Headers $headers');
  if (req.body) params.push('-Body $body');
  if (req.insecure) params.push('-SkipCertificateCheck');
  lines.push('Invoke-RestMethod ' + params.join(' `\n    '));
  return lines.join('\n');
}

// ------------------------------------------------------------------- Go ----

function generateGo(req) {
  const needsTls = req.insecure;
  const lines = ['package main', '', 'import ('];
  lines.push('\t"fmt"', '\t"io"', '\t"net/http"');
  if (req.body) lines.push('\t"strings"');
  if (needsTls) lines.push('\t"crypto/tls"');
  lines.push(')', '');
  lines.push('func main() {');
  lines.push(...formComment(req, '\t//'));

  if (req.body) {
    lines.push(`\tbody := strings.NewReader(\`${req.body.replace(/`/g, '` + "`" + `')}\`)`);
    lines.push(`\treq, err := http.NewRequest("${req.method}", "${esc(req.url)}", body)`);
  } else {
    lines.push(`\treq, err := http.NewRequest("${req.method}", "${esc(req.url)}", nil)`);
  }
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('');

  if (req.contentType) lines.push(`\treq.Header.Set("Content-Type", "${esc(req.contentType)}")`);
  for (const [name, value] of req.requestHeaders) lines.push(`\treq.Header.Set("${esc(name)}", "${esc(value)}")`);
  if (req.user) lines.push(`\treq.SetBasicAuth("${esc(req.authUser)}", "${esc(req.authPass)}")`);
  lines.push('');

  if (needsTls) {
    lines.push('\t// -k / --insecure was present -- InsecureSkipVerify disables TLS certificate');
    lines.push('\t// validation entirely. Only ever do this against a known-safe dev/test endpoint.');
    lines.push('\tclient := &http.Client{');
    lines.push('\t\tTransport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true}},');
    lines.push('\t}');
  } else {
    lines.push('\tclient := &http.Client{}');
  }
  lines.push('\tresp, err := client.Do(req)');
  lines.push('\tif err != nil {');
  lines.push('\t\tpanic(err)');
  lines.push('\t}');
  lines.push('\tdefer resp.Body.Close()');
  lines.push('');
  lines.push('\trespBody, _ := io.ReadAll(resp.Body)');
  lines.push('\tfmt.Println(string(respBody))');
  lines.push('}');
  return lines.join('\n');
}

// ----------------------------------------------------------------- Java ----

function generateJava(req) {
  const needsAuth = !!req.user;
  const needsTls = req.insecure;
  const lines = [];
  lines.push('import java.net.URI;');
  lines.push('import java.net.http.HttpClient;');
  lines.push('import java.net.http.HttpRequest;');
  lines.push('import java.net.http.HttpResponse;');
  if (needsAuth) lines.push('import java.util.Base64;');
  if (needsTls) { lines.push('import javax.net.ssl.SSLContext;'); lines.push('import javax.net.ssl.X509TrustManager;'); }
  lines.push('');
  lines.push(...formComment(req, '//'));

  if (needsTls) {
    lines.push('// -k / --insecure was present -- this trust manager accepts any certificate,');
    lines.push('// disabling TLS validation entirely. Only ever do this against a known-safe');
    lines.push('// dev/test endpoint.');
    lines.push('SSLContext sslContext = SSLContext.getInstance("TLS");');
    lines.push('sslContext.init(null, new javax.net.ssl.TrustManager[] { new X509TrustManager() {');
    lines.push('    public void checkClientTrusted(java.security.cert.X509Certificate[] c, String a) {}');
    lines.push('    public void checkServerTrusted(java.security.cert.X509Certificate[] c, String a) {}');
    lines.push('    public java.security.cert.X509Certificate[] getAcceptedIssuers() { return new java.security.cert.X509Certificate[0]; }');
    lines.push('} }, new java.security.SecureRandom());');
    lines.push('');
    lines.push('HttpClient client = HttpClient.newBuilder().sslContext(sslContext).build();');
  } else {
    lines.push('HttpClient client = HttpClient.newHttpClient();');
  }
  lines.push('');

  lines.push('HttpRequest request = HttpRequest.newBuilder()');
  lines.push(`    .uri(URI.create("${esc(req.url)}"))`);
  if (req.contentType) lines.push(`    .header("Content-Type", "${esc(req.contentType)}")`);
  for (const [name, value] of req.requestHeaders) lines.push(`    .header("${esc(name)}", "${esc(value)}")`);
  if (needsAuth) {
    lines.push('    // HttpRequest.Builder has no direct basic-auth method for a single request --');
    lines.push('    // encoding it into the header directly is simpler than java.net.Authenticator here.');
    lines.push(`    .header("Authorization", "Basic " + Base64.getEncoder().encodeToString("${esc(req.authUser)}:${esc(req.authPass)}".getBytes()))`);
  }
  const bodyExpr = req.body ? `HttpRequest.BodyPublishers.ofString("${esc(req.body)}")` : 'HttpRequest.BodyPublishers.noBody()';
  lines.push(`    .method("${req.method}", ${bodyExpr})`);
  lines.push('    .build();');
  lines.push('');
  lines.push('HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());');
  lines.push('System.out.println(response.body());');
  return lines.join('\n');
}

const GENERATORS = [
  { id: 'csharp', label: 'C#', fn: generateCSharp },
  { id: 'python', label: 'Python', fn: generatePython },
  { id: 'fetch', label: 'JavaScript (fetch)', fn: generateFetch },
  { id: 'axios', label: 'Node.js (axios)', fn: generateAxios },
  { id: 'powershell', label: 'PowerShell', fn: generatePowerShell },
  { id: 'go', label: 'Go', fn: generateGo },
  { id: 'java', label: 'Java', fn: generateJava },
];

// ------------------------------------------------------- syntax highlight ----
// One shared tokenizer (comment / string / keyword / PowerShell $variable),
// same single-pass-alternation technique json-formatter.js uses for JSON --
// whichever alternative matches consumes that whole token, so text inside an
// already-matched string can never get separately re-scanned as a keyword.

const LANG_KEYWORDS = {
  csharp: ['using', 'var', 'new', 'await', 'class', 'public', 'private', 'static', 'void', 'string', 'null', 'true', 'false', 'return'],
  java: ['import', 'class', 'public', 'private', 'static', 'void', 'new', 'null', 'true', 'false', 'return', 'throws'],
  python: ['import', 'def', 'return', 'True', 'False', 'None', 'await', 'if', 'else'],
  go: ['package', 'import', 'func', 'var', 'return', 'if', 'nil', 'true', 'false', 'defer', 'panic'],
  fetch: ['const', 'let', 'var', 'async', 'await', 'new'],
  axios: ['const', 'let', 'var', 'async', 'await', 'new', 'require'],
};

function escapeHtmlForDisplay(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function highlightCode(code, langId) {
  const escaped = escapeHtmlForDisplay(code);
  const isHashComment = langId === 'python' || langId === 'powershell';
  const commentPattern = isHashComment ? '#[^\\n]*' : '\\/\\/[^\\n]*';

  let stringPattern;
  if (langId === 'go') {
    // Go raw strings (backtick-delimited, no escapes) alongside interpreted ones.
    stringPattern = '`[^`]*`|"(?:\\\\.|[^"\\\\])*"';
  } else if (langId === 'powershell') {
    // PowerShell escapes with a backtick, not a backslash -- `" doesn't end the string.
    stringPattern = '"(?:`.|[^"`])*"|\'(?:\'\'|[^\'])*\'';
  } else if (langId === 'python') {
    stringPattern = '"(?:\\\\.|[^"\\\\])*"|\'(?:\\\\.|[^\'\\\\])*\'';
  } else {
    stringPattern = '"(?:\\\\.|[^"\\\\])*"';
  }

  const kwList = LANG_KEYWORDS[langId] || [];
  const kwPattern = kwList.length ? '\\b(?:' + kwList.join('|') + ')\\b' : '(?!)';
  const psVarPattern = langId === 'powershell' ? '\\$[A-Za-z_][A-Za-z0-9_]*' : '(?!)';

  const tokenRe = new RegExp(`(${commentPattern})|(${stringPattern})|(${kwPattern})|(${psVarPattern})`, 'g');

  return escaped.replace(tokenRe, (match, com, str, kw, psvar) => {
    if (com !== undefined) return `<span class="code-com">${match}</span>`;
    if (str !== undefined) return `<span class="code-str">${match}</span>`;
    if (kw !== undefined) return `<span class="code-kw">${match}</span>`;
    if (psvar !== undefined) return `<span class="code-var">${match}</span>`;
    return match;
  });
}

let lastReq = null;

function convert() {
  const input = document.getElementById('curlInput').value;
  const errEl = document.getElementById('curlError');
  try {
    lastReq = parseCurl(input);
    render();
    errEl.style.display = 'none';
  } catch (e) {
    lastReq = null;
    resetOutput();
    errEl.textContent = e.message;
    errEl.style.display = 'block';
  }
}

function resetOutput() {
  const out = document.getElementById('codeOutput');
  out.textContent = 'Paste a curl command on the left and click Convert.';
  out.classList.add('output-empty');
}

function render() {
  const out = document.getElementById('codeOutput');
  if (!lastReq) { resetOutput(); return; }
  const langId = document.getElementById('langSelect').value;
  const gen = GENERATORS.find(g => g.id === langId) || GENERATORS[0];
  out.classList.remove('output-empty');
  out.innerHTML = highlightCode(gen.fn(lastReq), gen.id);
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
  resetOutput();
  document.getElementById('curlError').style.display = 'none';
  lastReq = null;
}

document.getElementById('btnCurlConvert').addEventListener('click', convert);
document.getElementById('btnCurlExample').addEventListener('click', tryExample);
document.getElementById('btnCurlClear').addEventListener('click', clearAll);
document.getElementById('langSelect').addEventListener('change', render);
document.getElementById('curlInput').addEventListener('input', () => {
  clearTimeout(window.__curlDebounce);
  window.__curlDebounce = setTimeout(convert, 400);
});
