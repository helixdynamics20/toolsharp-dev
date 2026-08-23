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

  return output;
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
      errorMsg += ` <span class="repair-link" onclick="applyAppsettingsRepair()">Auto-fix it</span>`;
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
      <div class="tab">formatted <button class="copy-btn" onclick="copyFormatted()">copy</button></div>
      <div class="output-block"><pre id="asFormatted">${escapeHtml(formatted)}</pre></div>
    </div>
  `;
}

function copyFormatted() {
  navigator.clipboard.writeText(document.getElementById('asFormatted').textContent);
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

window.addEventListener('DOMContentLoaded', () => {
  const inputEl = document.getElementById('asInput');
  if (inputEl) {
    inputEl.addEventListener('paste', () => {
      setTimeout(() => {
        const text = inputEl.value;
        try {
          JSON.parse(text);
          validateAppsettings();
        } catch (_) {
          // Check if repairable
          const repaired = tryRepairJson(text);
          try {
            JSON.parse(repaired);
            validateAppsettings();
          } catch (__) {}
        }
      }, 50);
    });
  }
});
