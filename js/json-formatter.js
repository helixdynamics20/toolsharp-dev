function findLineCol(text, index) {
  const lines = text.slice(0, index).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

function findDuplicateKeys(text) {
  let dupes = [];
  let objStack = [{}];
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (ch === '"') {
      let j = i + 1;
      let str = '';
      while (j < n && text[j] !== '"') {
        if (text[j] === '\\') { str += text[j] + text[j+1]; j += 2; continue; }
        str += text[j]; j++;
      }
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
    if (ch === '{') { objStack.push({}); i++; continue; }
    if (ch === '}') { objStack.pop(); i++; continue; }
    i++;
  }
  return [...new Set(dupes)];
}

function getIndent() {
  const v = document.getElementById('jsonIndent').value;
  return v === 'tab' ? '\t' : parseInt(v, 10);
}

let _lastParsed = null;

function renderTreeHtml(obj) {
  function val(v) {
    if (v === null) return `<span class="jt-null">null</span>`;
    if (typeof v === 'boolean') return `<span class="jt-bool">${v}</span>`;
    if (typeof v === 'number') return `<span class="jt-num">${v}</span>`;
    if (typeof v === 'string') {
      const display = v.length > 120 ? v.slice(0, 120) + '…' : v;
      return `<span class="jt-str">"${escapeHtml(display)}"</span>`;
    }
    if (Array.isArray(v)) {
      if (!v.length) return `<span class="jt-meta">[ ]</span>`;
      const items = v.map((item, i) => `<div class="jt-item"><span class="jt-idx">[${i}]</span><span class="jt-sep"> </span>${val(item)}</div>`).join('');
      return `<details open class="jt-node"><summary><span class="jt-meta">Array [${v.length}]</span></summary><div class="jt-children">${items}</div></details>`;
    }
    if (typeof v === 'object') {
      const keys = Object.keys(v);
      if (!keys.length) return `<span class="jt-meta">{ }</span>`;
      const items = keys.map(k => `<div class="jt-item"><span class="jt-key">${escapeHtml(k)}</span><span class="jt-sep">: </span>${val(v[k])}</div>`).join('');
      return `<details open class="jt-node"><summary><span class="jt-meta">Object {${keys.length}}</span></summary><div class="jt-children">${items}</div></details>`;
    }
    return escapeHtml(String(v));
  }
  return `<div class="json-tree">${val(obj)}</div>`;
}

function showJsonViewTab(tab) {
  const textEl = document.getElementById('jsonTextView');
  const treeEl = document.getElementById('jsonTreeView');
  const btnText = document.getElementById('jsonTabText');
  const btnTree = document.getElementById('jsonTabTree');
  if (!textEl) return;
  if (tab === 'tree') {
    textEl.style.display = 'none';
    if (treeEl) { treeEl.style.display = ''; if (!treeEl.innerHTML && _lastParsed !== null) treeEl.innerHTML = renderTreeHtml(_lastParsed); }
    if (btnText) btnText.classList.remove('active');
    if (btnTree) btnTree.classList.add('active');
  } else {
    textEl.style.display = '';
    if (treeEl) treeEl.style.display = 'none';
    if (btnText) btnText.classList.add('active');
    if (btnTree) btnTree.classList.remove('active');
  }
}

function renderResult(checks, formatted, parsed) {
  if (parsed !== undefined) _lastParsed = parsed;
  const resultDiv = document.getElementById('jsonResult');
  const hasOutput = formatted !== undefined;
  const hasTree = parsed !== undefined;

  const outputHtml = hasOutput ? `
    <div class="config-block" style="margin-top:16px;">
      <div class="tab" style="display:flex;align-items:center;gap:6px;">
        <span style="flex:1;">output</span>
        ${hasTree ? `<span class="json-view-tabs"><button id="jsonTabText" class="json-tab-btn active" onclick="showJsonViewTab('text')">text</button><button id="jsonTabTree" class="json-tab-btn" onclick="showJsonViewTab('tree')">tree</button></span>` : ''}
        <button class="copy-btn" onclick="copyJsonOut(this)">copy</button>
      </div>
      <div class="output-block">
        <div id="jsonTextView"><pre id="jsonOutputPre">${escapeHtml(formatted)}</pre></div>
        ${hasTree ? `<div id="jsonTreeView" style="display:none;padding:14px;"></div>` : ''}
      </div>
    </div>` : '';

  resultDiv.innerHTML = `
    <div class="config-block">
      <div class="body">
        ${checks.map(c => `<div class="callout ${c.type}" style="margin-top:0; margin-bottom:10px;">${c.msg}</div>`).join('')}
      </div>
    </div>
    ${outputHtml}
  `;
}

// Non-breaking spaces, other Unicode space separators, and zero-width
// characters are common when text is copied from Jira, Confluence, or
// Word. They look like ordinary whitespace but JSON's grammar only
// permits space/tab/CR/LF, so they break parsing at the exact point
// they appear — often right at the start of a line of "indentation".
// Built from numeric codepoints (no literal invisible chars in source).
// Normalized only where they act as structural whitespace below --
// never inside a string's contents, so real string data isn't altered.
const INVISIBLE_SPACE_CODEPOINTS = [
  0x00A0, 0x1680,
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A,
  0x202F, 0x205F, 0x3000, 0xFEFF,
];
const ZERO_WIDTH_CODEPOINTS = [0x200B, 0x200C, 0x200D, 0x2060];
const INVISIBLE_SPACE_SET = new Set(INVISIBLE_SPACE_CODEPOINTS.map(cp => String.fromCodePoint(cp)));
const ZERO_WIDTH_SET = new Set(ZERO_WIDTH_CODEPOINTS.map(cp => String.fromCodePoint(cp)));

function tryRepairJson(text) {

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

    // 4. Handle whitespace (normalize invisible space-like chars to a
    // real space -- only reached outside strings, since string contents
    // are consumed whole by branch 3 above, so real data is untouched)
    if (/\s/.test(char)) {
      output += INVISIBLE_SPACE_SET.has(char) ? ' ' : char;
      i++;
      continue;
    }

    // 4b. Strip zero-width characters (also only reached outside strings)
    if (ZERO_WIDTH_SET.has(char)) {
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
      } else if (!isNaN(Number(word))) {
        output += word;
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

  // Structural pass: fix missing commas/colons/brackets, mismatched
  // bracket types, and missing values -- see repairStructure() below.
  output = repairStructuralIssues(output);

  return output;
}

// ── structural repair: missing/mismatched commas, colons, and brackets ──
// Runs on text already normalized by the character-level pass above (so
// quotes are all double-quoted, comments are gone, literals normalized).
// This is a small lenient/recovering parser: it walks the token stream
// tracking what each open object/array currently expects next, and
// inserts or corrects whatever's missing so the result parses. It is a
// best-effort heuristic, not a mind-reader -- always spot-check the
// result against the source before trusting it (the tool says so too).

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
        if (tok.type === 'STRING') { out.push(tok); top.state = 'colon'; idx++; continue; }
        if (tok.type === 'LITERAL') { out.push({ type: 'STRING', value: '"' + tok.value.replace(/"/g, '\\"') + '"' }); top.state = 'colon'; idx++; continue; }
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

let _pendingAutoFixNote = false;

function applyJsonRepair() {
  const text = document.getElementById('jsonInput').value;
  const repaired = tryRepairJson(text);
  document.getElementById('jsonInput').value = repaired;
  _pendingAutoFixNote = true;
  formatJson();
}

function autoFixJson() {
  const text = document.getElementById('jsonInput').value;
  if (!text.trim()) return;
  const repaired = tryRepairJson(text);
  document.getElementById('jsonInput').value = repaired;
  _pendingAutoFixNote = true;
  formatJson();
}

function validateOnly(text) {
  if (!text.trim()) return null;
  try {
    const parsed = JSON.parse(text);
    const isStrict = document.getElementById('jsonStrict').checked;
    const dupes = isStrict ? findDuplicateKeys(text) : [];
    let checks = [{type: 'ok', msg: 'Valid JSON.'}];
    if (dupes.length) {
      checks.push({type: 'warn', msg: `Duplicate key(s) within the same object: ${dupes.map(d => `<code>${escapeHtml(d)}</code>`).join(', ')} — the last one silently wins in valid JSON.`});
    }
    return { parsed, checks };
  } catch (e) {
    const match = /position (\d+)/.exec(e.message);
    let locInfo = '';
    if (match) {
      const pos = parseInt(match[1], 10);
      const {line, col} = findLineCol(text, pos);
      locInfo = ` (around line ${line}, column ${col})`;
    }

    // Check if repair is possible
    let canRepair = false;
    try {
      const repaired = tryRepairJson(text);
      if (repaired !== text) {
        JSON.parse(repaired);
        canRepair = true;
      }
    } catch (_) {}

    return {
      error: `Invalid JSON: ${escapeHtml(e.message)}${locInfo}`,
      canRepair: canRepair
    };
  }
}

let _pendingPasteFormat = false;

function onJsonInput() {
  const text = document.getElementById('jsonInput').value;
  const wasPaste = _pendingPasteFormat;
  _pendingPasteFormat = false;

  if (!text.trim()) {
    document.getElementById('jsonResult').innerHTML = '<div class="config-block"><div class="output-block"><div class="empty">Paste JSON on the left and click Format, Minify, or just start typing to validate.</div></div></div>';
    return;
  }
  const result = validateOnly(text);
  if (result.error) {
    let msg = result.error;
    if (result.canRepair) {
      msg += ` <span class="repair-link" onclick="applyJsonRepair()">Auto-fix it</span>`;
    }
    renderResult([{type: 'error', msg: msg}]);
  } else if (wasPaste) {
    // pretty-print automatically once a full, valid paste lands
    const formatted = JSON.stringify(result.parsed, null, getIndent());
    renderResult(result.checks, formatted, result.parsed);
  } else {
    renderResult(result.checks);
  }
}

function formatJson() {
  const text = document.getElementById('jsonInput').value;
  const result = validateOnly(text);
  if (!result) return;
  if (result.error) {
    let msg = result.error;
    if (result.canRepair) {
      msg += ` <span class="repair-link" onclick="applyJsonRepair()">Auto-fix it</span>`;
    }
    renderResult([{type: 'error', msg: msg}]);
    return;
  }
  const formatted = JSON.stringify(result.parsed, null, getIndent());
  const checks = result.checks.slice();
  if (_pendingAutoFixNote) {
    _pendingAutoFixNote = false;
    checks.push({type: 'warn', msg: 'This was auto-fixed — missing commas, colons, brackets, quotes, or values may have been added or corrected automatically. Please review the result below against what you actually intended before relying on it.'});
  }
  renderResult(checks, formatted, result.parsed);
}

function minifyJson() {
  const text = document.getElementById('jsonInput').value;
  const result = validateOnly(text);
  if (!result) return;
  if (result.error) {
    let msg = result.error;
    if (result.canRepair) {
      msg += ` <span class="repair-link" onclick="applyJsonRepair()">Auto-fix it</span>`;
    }
    renderResult([{type: 'error', msg: msg}]);
    return;
  }
  const minified = JSON.stringify(result.parsed);
  renderResult(result.checks, minified, result.parsed);
}

function convertToYaml() {
  const text = document.getElementById('jsonInput').value;
  const result = validateOnly(text);
  if (!result) return;
  if (result.error) {
    let msg = result.error;
    if (result.canRepair) {
      msg += ` <span class="repair-link" onclick="applyJsonRepair()">Auto-fix it</span>`;
    }
    renderResult([{type: 'error', msg: msg}]);
    return;
  }

  function jsonToYaml(obj, depth = 0) {
    const spacing = '  '.repeat(depth);
    if (obj === null) return 'null';
    if (typeof obj === 'undefined') return '';
    if (typeof obj !== 'object') {
      if (typeof obj === 'string') {
        if (obj.includes('\n') || obj.includes(':') || obj.startsWith(' ') || obj.includes('#')) {
          return `"${obj.replace(/"/g, '\\"')}"`;
        }
        return obj;
      }
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]';
      return '\n' + obj.map(item => {
        const valStr = jsonToYaml(item, depth + 1);
        if (typeof item === 'object' && item !== null) {
          // If it is an object or array, indent it correctly
          return `${spacing}- ${valStr.trimStart()}`;
        }
        return `${spacing}- ${valStr}`;
      }).join('\n');
    }

    const keys = Object.keys(obj);
    if (keys.length === 0) return '{}';
    
    return keys.map((key, index) => {
      const val = obj[key];
      const valStr = jsonToYaml(val, depth + 1);
      const prefix = index === 0 && depth > 0 ? '' : spacing;
      
      if (typeof val === 'object' && val !== null) {
        return `${prefix}${key}:${valStr}`;
      } else {
        return `${prefix}${key}: ${valStr}`;
      }
    }).join('\n');
  }

  try {
    const yaml = jsonToYaml(result.parsed);
    renderResult(result.checks, yaml);
  } catch (err) {
    renderResult([{type: 'error', msg: `Could not convert to YAML: ${err.message}`}]);
  }
}

function copyJsonOut(btn) {
  navigator.clipboard.writeText(document.getElementById('jsonOutputPre').textContent);
  flashCopied(btn);
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('jsonInput');
  if (inputEl) {
    // the browser fires 'input' right after 'paste' commits the new value,
    // so just flag it here instead of re-reading .value on a fixed delay
    // (a delay-based re-read can catch a large paste mid-write and validate
    // a truncated snapshot, flashing a false "invalid JSON" error).
    inputEl.addEventListener('paste', () => { _pendingPasteFormat = true; });
  }
});
