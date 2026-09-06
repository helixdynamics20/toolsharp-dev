function findLineCol(text, index) {
  const lines = text.slice(0, index).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function findDuplicateKeys(text) {
  // Walk the raw text tracking object depth and collect key names per depth level.
  let dupes = [];
  let stack = [{}]; // key counts per open object, by depth
  let i = 0;
  const n = text.length;
  let depth = 0;
  let objStack = [{}];

  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      // read string
      let j = i + 1;
      let str = '';
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') { str += text[j] + text[j+1]; j += 2; continue; }
        str += text[j]; j++;
      }
      // check if this string is a key (followed by optional whitespace then colon)
      let k = j + 1;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === ':') {
        const top = objStack[objStack.length - 1];
        if (top[str] === undefined) top[str] = 0;
        top[str]++;
        if (top[str] === 2) dupes.push(str);
      }
      i = j + 1;
      continue;
    }
    if (ch === '{') { objStack.push({}); depth++; i++; continue; }
    if (ch === '}') { objStack.pop(); depth--; i++; continue; }
    i++;
  }
  return [...new Set(dupes)];
}

function tryRepairJson(text) {
  // appsettings.json is routinely saved with a UTF-8 byte-order-mark by
  // various .NET tooling/editors, and a copy/paste carries it straight
  // into the textarea as a literal U+FEFF character. JSON.parse rejects
  // it outright (it's not one of the four whitespace characters the JSON
  // grammar allows), and without stripping it here the "repaired" text
  // would still start with it and fail to re-parse identically -- Auto-fix
  // would silently do nothing for a file in this genuinely common state.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  let output = '';
  let i = 0;
  const n = text.length;

  while (i < n) {
    const char = text[i];

    // 1. Handle line comments
    if (char === '/' && text[i + 1] === '/') {
      i += 2;
      while (i < n && text[i] !== '\n' && text[i] !== '\r') {
        i++;
      }
      continue;
    }

    // 2. Handle block comments
    if (char === '/' && text[i + 1] === '*') {
      i += 2;
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) {
        i++;
      }
      i += 2;
      continue;
    }

    // 3. Handle strings (single or double quoted)
    if (char === '"' || char === "'") {
      const quoteType = char;
      output += '"'; // always output double quotes
      i++;
      while (i < n) {
        if (text[i] === '\\') {
          const nextChar = text[i + 1];
          if (quoteType === "'" && nextChar === "'") {
            // escaped single quote inside single-quoted string -> unescaped single quote
            output += "'";
            i += 2;
          } else if (quoteType === '"' && nextChar === '"') {
            // escaped double quote inside double-quoted string -> keep it escaped
            output += '\\"';
            i += 2;
          } else {
            // keep other escapes (like \n, \t, \\) exactly as they are
            output += '\\' + nextChar;
            i += 2;
          }
        } else if (text[i] === quoteType) {
          i++; // closing quote
          break;
        } else {
          const current = text[i];
          if (quoteType === "'" && current === '"') {
            // literal double quote inside single-quoted string -> escape it
            output += '\\"';
          } else {
            output += current;
          }
          i++;
        }
      }
      output += '"';
      continue;
    }

    // 4. Handle whitespace
    if (/\s/.test(char)) {
      output += char;
      i++;
      continue;
    }

    // 5. Structural characters
    if (char === ':' || char === ',' || char === '{' || char === '}' || char === '[' || char === ']') {
      output += char;
      i++;
      continue;
    }

    // 6. Words/numbers/identifiers
    let word = '';
    while (i < n && /[a-zA-Z0-9_\-\+\.]/.test(text[i])) {
      word += text[i];
      i++;
    }

    if (word.length > 0) {
      if (word === 'True') {
        output += 'true';
      } else if (word === 'False') {
        output += 'false';
      } else if (word === 'None') {
        output += 'null';
      } else if (word === 'true' || word === 'false' || word === 'null') {
        output += word;
      } else if (word === 'NaN' || word === 'Infinity' || word === '-Infinity') {
        // JSON has no NaN/Infinity literals -- JSON.stringify() itself
        // serializes these as null, so repairing to null keeps parity with
        // that instead of emitting a bare word that fails the re-parse
        // check below and silently declines to offer any fix at all.
        output += 'null';
      } else if (word === 'undefined') {
        // Same failure mode as Infinity/NaN, just a value rather than a
        // number: valid in JS, never valid in JSON. Without this it fell
        // through to the generic bare-word branch below and got quoted
        // into the literal string "undefined" -- silently turning a
        // missing/placeholder value into real (wrong) string data.
        output += 'null';
      } else if (!isNaN(Number(word))) {
        // Number(word) accepts syntax JSON's own number grammar doesn't --
        // a leading "+", or a "." with no digit before it (with or without
        // a leading "-") -- so a technically-numeric word could still fail
        // the re-parse check below and get silently dropped as unrepairable.
        let num = word;
        if (num[0] === '+') num = num.slice(1);
        if (num[0] === '.') num = '0' + num;
        else if (num.startsWith('-.')) num = '-0' + num.slice(1);
        // A leading zero before another digit ("01", "007") is also
        // Number()-parseable but not valid JSON. The /^0\d/ guard only
        // fires when the second character is itself a digit, so this
        // never touches a hex literal like "0x1F" (second char 'x') or an
        // already-valid "0.5"/"0e5" (second char '.'/'e').
        if (/^0\d/.test(num)) {
          const m = /^0+(\d.*)$/.exec(num);
          if (m) num = m[1];
        } else if (/^-0\d/.test(num)) {
          const m = /^-0+(\d.*)$/.exec(num);
          if (m) num = '-' + m[1];
        }
        output += num;
      } else {
        output += '"' + word + '"';
      }
    } else {
      output += char;
      i++;
    }
  }

  // Clean up trailing commas before closing braces/brackets
  output = output.replace(/,\s*([\}\]])/g, '$1');

  // Structural pass: fix missing commas/colons/brackets and missing
  // values -- see repairStructuralIssues() below. Ported from
  // json-formatter.js, which had this and this file didn't: a missing
  // comma between two properties -- arguably the single most common real
  // JSON typo -- previously left this tool's own "Auto-fix it" link doing
  // nothing at all, since the character-level pass above never touches
  // anything when the only problem is a missing separator.
  output = repairStructuralIssues(output);

  return output;
}

// -- structural repair: missing/mismatched commas, colons, and brackets --
// Runs on text already normalized by the character-level pass above (so
// quotes are all double-quoted, comments are gone, literals normalized).
// This is a small lenient/recovering parser: it walks the token stream
// tracking what each open object/array currently expects next, and
// inserts or corrects whatever's missing so the result parses. It is a
// best-effort heuristic, not a mind-reader -- always spot-check the
// result against the source before trusting it (the tool says so too).
// Verbatim port of json-formatter.js's version of the same three
// functions (self-contained, no dependency on its repair-log system).

function tokenizeForStructuralRepair(text) {
  const tokens = [];
  let i = 0;
  const n = text.length;
  function isDelim(ch) {
    return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' ||
      ch === '{' || ch === '}' || ch === '[' || ch === ']' ||
      ch === ':' || ch === ',' || ch === '"';
  }
  while (i < n) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    if (c === '{' || c === '}' || c === '[' || c === ']' || c === ':' || c === ',') {
      tokens.push({ type: c, value: c });
      i++; continue;
    }
    if (c === '"') {
      let j = i + 1;
      let raw = '"';
      let closed = false;
      while (j < n) {
        if (text[j] === '\\') { raw += text[j] + (text[j + 1] || ''); j += 2; continue; }
        if (text[j] === '"') { raw += '"'; j++; closed = true; break; }
        raw += text[j]; j++;
      }
      if (!closed) raw += '"'; // unterminated string at EOF -- close it
      tokens.push({ type: 'STRING', value: raw });
      i = j; continue;
    }
    let j = i;
    while (j < n && !isDelim(text[j])) j++;
    if (j === i) { i++; continue; } // stray char we don't recognize -- drop
    tokens.push({ type: 'LITERAL', value: text.slice(i, j) });
    i = j;
  }
  return tokens;
}

function repairTokenStructure(tokens) {
  const out = [];
  const stack = [];
  let rootDone = false;

  function isCloser(tok) { return tok && (tok.type === '}' || tok.type === ']'); }
  function isValueStart(tok) { return tok && (tok.type === 'STRING' || tok.type === 'LITERAL' || tok.type === '{' || tok.type === '['); }
  function afterClose() {
    const newTop = stack[stack.length - 1];
    if (!newTop) { rootDone = true; return; }
    newTop.state = 'comma';
    newTop.empty = false;
  }
  // Plain text of a token, quotes/escaping stripped -- used to rejoin
  // consecutive bare words back into one string (see the 'key' state
  // below).
  function rawValueOf(tok) {
    if (tok.type === 'STRING') return tok.value.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    return tok.value;
  }

  let idx = 0;
  let guard = 0;
  const guardMax = tokens.length * 4 + 10;
  while (idx < tokens.length) {
    if (++guard > guardMax) break; // safety valve -- should be unreachable
    const tok = tokens[idx];
    const top = stack[stack.length - 1];

    if (!top) {
      if (rootDone) { idx++; continue; }
      if (tok.type === '{') { out.push(tok); stack.push({ type: 'obj', state: 'key' }); idx++; continue; }
      if (tok.type === '[') { out.push(tok); stack.push({ type: 'arr', state: 'value', empty: true }); idx++; continue; }
      if (tok.type === 'STRING' || tok.type === 'LITERAL') { out.push(tok); rootDone = true; idx++; continue; }
      idx++; continue; // stray closer/colon/comma at root
    }

    if (top.type === 'obj') {
      if (top.state === 'key') {
        if (isCloser(tok)) { out.push({ type: '}', value: '}' }); stack.pop(); afterClose(); idx++; continue; }
        if (tok.type === 'STRING' || tok.type === 'LITERAL') {
          // Consecutive bare words/strings with nothing but whitespace
          // between them, still expecting a key, almost always means the
          // key itself contains a space and lost its quotes (e.g.
          // {first name: "John"}) -- a key position can only ever be
          // followed by a colon in valid JSON, so "two keys in a row"
          // isn't a real alternative reading. Joining them into one key
          // beats quoting each separately and fabricating a comma + a
          // null value between them, which silently produced wrong data
          // that still looked like it had parsed successfully.
          const parts = [rawValueOf(tok)];
          idx++;
          while (idx < tokens.length && (tokens[idx].type === 'STRING' || tokens[idx].type === 'LITERAL')) {
            parts.push(rawValueOf(tokens[idx]));
            idx++;
          }
          out.push({ type: 'STRING', value: '"' + parts.join(' ').replace(/"/g, '\\"') + '"' });
          top.state = 'colon';
          continue;
        }
        idx++; continue; // stray comma/colon while expecting a key
      }
      if (top.state === 'colon') {
        if (tok.type === ':') { out.push(tok); top.state = 'value'; idx++; continue; }
        out.push({ type: ':', value: ':' });
        top.state = 'value';
        continue; // reprocess tok as the value
      }
      if (top.state === 'value') {
        if (tok.type === '{') { out.push(tok); stack.push({ type: 'obj', state: 'key' }); idx++; continue; }
        if (tok.type === '[') { out.push(tok); stack.push({ type: 'arr', state: 'value', empty: true }); idx++; continue; }
        if (tok.type === 'STRING' || tok.type === 'LITERAL') { out.push(tok); top.state = 'comma'; idx++; continue; }
        if (isCloser(tok)) { out.push({ type: 'LITERAL', value: 'null' }); top.state = 'comma'; continue; }
        if (tok.type === ',') { out.push({ type: 'LITERAL', value: 'null' }); top.state = 'comma'; continue; }
        idx++; continue; // stray colon
      }
      if (top.state === 'comma') {
        if (tok.type === ',') { out.push(tok); top.state = 'key'; idx++; continue; }
        if (isCloser(tok)) { out.push({ type: '}', value: '}' }); stack.pop(); afterClose(); idx++; continue; }
        if (isValueStart(tok)) { out.push({ type: ',', value: ',' }); top.state = 'key'; continue; }
        idx++; continue; // stray colon
      }
    }

    if (top.type === 'arr') {
      if (top.state === 'value') {
        if (isCloser(tok)) { out.push({ type: ']', value: ']' }); stack.pop(); afterClose(); idx++; continue; }
        top.empty = false;
        if (tok.type === '{') { out.push(tok); stack.push({ type: 'obj', state: 'key' }); idx++; continue; }
        if (tok.type === '[') { out.push(tok); stack.push({ type: 'arr', state: 'value', empty: true }); idx++; continue; }
        if (tok.type === 'STRING' || tok.type === 'LITERAL') { out.push(tok); top.state = 'comma'; idx++; continue; }
        if (tok.type === ',') { out.push({ type: 'LITERAL', value: 'null' }); top.state = 'comma'; continue; }
        idx++; continue; // stray colon
      }
      if (top.state === 'comma') {
        if (tok.type === ',') { out.push(tok); top.state = 'value'; idx++; continue; }
        if (isCloser(tok)) { out.push({ type: ']', value: ']' }); stack.pop(); afterClose(); idx++; continue; }
        if (isValueStart(tok)) { out.push({ type: ',', value: ',' }); top.state = 'value'; continue; }
        idx++; continue; // stray colon
      }
    }
  }

  // EOF: close any still-open containers, synthesizing missing pieces
  while (stack.length) {
    const c = stack.pop();
    if (c.type === 'obj') {
      if (c.state === 'colon') { out.push({ type: ':', value: ':' }); out.push({ type: 'LITERAL', value: 'null' }); }
      else if (c.state === 'value') { out.push({ type: 'LITERAL', value: 'null' }); }
      out.push({ type: '}', value: '}' });
    } else {
      if (c.state === 'value' && !c.empty) { out.push({ type: 'LITERAL', value: 'null' }); }
      out.push({ type: ']', value: ']' });
    }
  }

  return out;
}

function repairStructuralIssues(text) {
  const tokens = tokenizeForStructuralRepair(text);
  const repaired = repairTokenStructure(tokens);
  let result = repaired.map(t => t.value).join(' ');
  result = result.replace(/,\s*([}\]])/g, '$1');
  return result;
}

function applyAppsettingsRepair() {
  const text = document.getElementById('asInput').value;
  const repaired = tryRepairJson(text);
  document.getElementById('asInput').value = repaired;
  validateAppsettings();
}

function autoFixAppsettings() {
  const text = document.getElementById('asInput').value;
  if (!text.trim()) return;
  const repaired = tryRepairJson(text);
  document.getElementById('asInput').value = repaired;
  validateAppsettings();
}

let _asInputTimer = null;

// While the text is invalid, validateAppsettings() reruns tryRepairJson()
// from scratch to check if an auto-fix link should show — debounce plain
// typing so a long broken paste being edited doesn't reparse on every
// keystroke.
function scheduleValidateAppsettings() {
  clearTimeout(_asInputTimer);
  _asInputTimer = setTimeout(validateAppsettings, 200);
}

function validateAppsettings() {
  const text = document.getElementById('asInput').value;
  const resultDiv = document.getElementById('asResult');
  if (!text.trim()) {
    resultDiv.innerHTML = '<div class="callout warn">Paste some JSON first.</div>';
    return;
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    const match = /position (\d+)/.exec(e.message);
    let locInfo = '';
    if (match) {
      const pos = parseInt(match[1], 10);
      const {line, col} = findLineCol(text, pos);
      locInfo = ` (around line ${line}, column ${col})`;
    }

    let canRepair = false;
    try {
      const repaired = tryRepairJson(text);
      if (repaired !== text) {
        JSON.parse(repaired);
        canRepair = true;
      }
    } catch (_) {}

    let errorMsg = `Invalid JSON: ${escapeHtml(e.message)}${locInfo}`;
    if (canRepair) {
      errorMsg += ` <span class="repair-link">Auto-fix it</span>`;
    }

    resultDiv.innerHTML = `
      <div class="config-block">
        <div class="tab">result</div>
        <div class="body">
          <div class="callout error">${errorMsg}</div>
        </div>
      </div>`;
    return;
  }

  const formatted = JSON.stringify(parsed, null, 2);
  const isStrict = document.getElementById('asStrict').checked;
  const dupes = isStrict ? findDuplicateKeys(text) : [];

  let checks = [];
  checks.push({type: 'ok', msg: 'Valid JSON.'});

  if (isStrict) {
    if (dupes.length) {
      checks.push({type: 'error', msg: `Duplicate key(s) found within the same object: ${dupes.map(d => `<code>${escapeHtml(d)}</code>`).join(', ')} — in valid JSON the last one silently wins, which usually isn't what was intended.`});
    }

    // ConnectionStrings empty value check
    if (parsed.ConnectionStrings && typeof parsed.ConnectionStrings === 'object') {
      Object.entries(parsed.ConnectionStrings).forEach(([k, v]) => {
        if (v === '' || v === null) {
          checks.push({type: 'warn', msg: `ConnectionStrings.${escapeHtml(k)} is empty — likely meant to be supplied via environment variable, user secrets, or a vault at deploy time.`});
        }
      });
    }

    // plaintext secret heuristic
    const secretKeyPattern = /password|secret|apikey|api_key|token|connectionstring/i;
    let flaggedSecrets = [];
    (function walk(obj, path) {
      if (obj === null || typeof obj !== 'object') return;
      Object.entries(obj).forEach(([k, v]) => {
        const fullPath = path ? `${path}.${k}` : k;
        if (typeof v === 'string' && v.length > 0 && secretKeyPattern.test(k) && !/connectionstrings\./i.test(fullPath.toLowerCase()) === false) {
          // allow ConnectionStrings section itself since that's expected to hold a string
        }
        if (typeof v === 'string' && v.length > 3 && secretKeyPattern.test(k) && !fullPath.toLowerCase().startsWith('connectionstrings')) {
          flaggedSecrets.push(fullPath);
        }
        if (typeof v === 'object') walk(v, fullPath);
      });
    })(parsed, '');

    if (flaggedSecrets.length) {
      checks.push({type: 'warn', msg: `Key name(s) suggest secret material sitting directly in the file: ${flaggedSecrets.map(p => `<code>${escapeHtml(p)}</code>`).join(', ')}. Worth confirming these are dev-only values, not something checked into source control for a real environment.`});
    }
  }

  resultDiv.innerHTML = `
    <div class="config-block">
      <div class="tab">result</div>
      <div class="body">
        ${checks.map(c => `<div class="callout ${c.type}" style="margin-top:0; margin-bottom:10px;">${c.msg}</div>`).join('')}
      </div>
    </div>
    <div class="config-block" style="margin-top:16px;">
      <div class="tab">formatted <button class="copy-btn" data-copy="asFormatted">copy</button></div>
      <div class="output-block"><pre id="asFormatted">${highlightJsonText(formatted)}</pre></div>
    </div>
  `;
}

function clearAppsettingsInput() {
  document.getElementById('asInput').value = '';
  validateAppsettings();
}

function tryAppsettingsExample() {
  document.getElementById('asInput').value = JSON.stringify({
    Logging: { LogLevel: { Default: 'Information' } },
    ConnectionStrings: { Default: '' },
    ApiKey: 'sk_live_12345',
    AllowedHosts: '*'
  }, null, 2);
  document.getElementById('asStrict').checked = true;
  validateAppsettings();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Syntax-highlight JSON text using the shared .jt-* classes (css/style.css)
function highlightJsonText(jsonString) {
  const escaped = escapeHtml(jsonString);
  const tokenRe = /"(?:\\u[0-9a-fA-F]{4}|\\[^u]|[^\\"])*"|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  return escaped.replace(tokenRe, (match, offset, full) => {
    let cls;
    if (match[0] === '"') {
      const rest = full.slice(offset + match.length);
      cls = /^\s*:/.test(rest) ? 'jt-key' : 'jt-str';
    } else if (match === 'true' || match === 'false') {
      cls = 'jt-bool';
    } else if (match === 'null') {
      cls = 'jt-null';
    } else {
      cls = 'jt-num';
    }
    return `<span class="${cls}">${match}</span>`;
  });
}

persistFormState('appsettings-validator', ['asStrict']);


document.getElementById('asInput').addEventListener('input', scheduleValidateAppsettings);
document.getElementById('asStrict').addEventListener('change', validateAppsettings);
document.getElementById('btnAsValidate').addEventListener('click', validateAppsettings);
document.getElementById('btnAsAutoFix').addEventListener('click', autoFixAppsettings);
document.getElementById('btnAsExample').addEventListener('click', tryAppsettingsExample);
document.getElementById('btnAsClear').addEventListener('click', clearAppsettingsInput);

document.addEventListener('click', function (e) {
  if (e.target.closest('.repair-link')) applyAppsettingsRepair();
});
