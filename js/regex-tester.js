let rxDebounceHandle = null;

function runRegex() {
  // Light debounce: matching now runs in a worker (async round-trip), and
  // this avoids spawning a fresh worker on every single keystroke.
  clearTimeout(rxDebounceHandle);
  rxDebounceHandle = setTimeout(runRegexNow, 150);
}

function runRegexNow() {
  const pattern = document.getElementById('rxPattern').value;
  const testStr = document.getElementById('rxTestString').value;
  const highlightDiv = document.getElementById('regexHighlighted');
  const metaDiv = document.getElementById('rxMeta');
  const groupsDiv = document.getElementById('rxGroups');

  const explainDiv = document.getElementById('rxExplain');
  if (!pattern) {
    highlightDiv.textContent = 'Enter a pattern and test string.';
    highlightDiv.classList.add('empty');
    metaDiv.innerHTML = '';
    groupsDiv.innerHTML = '';
    if (explainDiv) explainDiv.innerHTML = '';
    return;
  }
  if (explainDiv) explainDiv.innerHTML = renderExplanation(pattern);

  let flags = '';
  if (document.getElementById('rxIgnoreCase').checked) flags += 'i';
  if (document.getElementById('rxMultiline').checked) flags += 'm';
  if (document.getElementById('rxSingleline').checked) flags += 's';
  const findAll = document.getElementById('rxGlobal').checked;
  if (findAll) flags += 'g';

  // Constructing a RegExp is always fast and safe to validate synchronously
  // — it's only *executing* it against text that can hang on a pathological
  // pattern, which is why the actual matching below runs in a worker.
  try {
    new RegExp(pattern, flags);
  } catch (e) {
    highlightDiv.classList.remove('empty');
    highlightDiv.innerHTML = '';
    metaDiv.innerHTML = `<div class="callout error">Invalid pattern: ${escapeHtml(e.message)}</div>`;
    groupsDiv.innerHTML = '';
    return;
  }

  if (!testStr) {
    highlightDiv.textContent = 'Enter a test string to see matches.';
    highlightDiv.classList.add('empty');
    metaDiv.innerHTML = '';
    groupsDiv.innerHTML = '';
    return;
  }

  highlightDiv.classList.remove('empty');
  runRegexInWorker(pattern, flags, testStr, findAll);
}

let rxWorker = null;
let rxRequestId = 0;
let rxTimeoutHandle = null;
const RX_TIMEOUT_MS = 2000;

function runRegexInWorker(pattern, flags, testStr, findAll) {
  const requestId = ++rxRequestId;
  if (rxWorker) rxWorker.terminate();
  clearTimeout(rxTimeoutHandle);

  rxWorker = new Worker('../js/regex-tester-worker.js');

  rxTimeoutHandle = setTimeout(() => {
    if (requestId !== rxRequestId) return;
    rxWorker.terminate();
    rxWorker = null;
    document.getElementById('regexHighlighted').innerHTML = '';
    document.getElementById('rxMeta').innerHTML = '<div class="callout error">This pattern took too long to match — likely catastrophic backtracking (e.g. a nested quantifier like <code>(a+)+</code> against text that almost matches). Simplify the pattern or shorten the test string.</div>';
    document.getElementById('rxGroups').innerHTML = '';
  }, RX_TIMEOUT_MS);

  rxWorker.onmessage = (e) => {
    if (requestId !== rxRequestId) return; // superseded by a newer keystroke
    clearTimeout(rxTimeoutHandle);
    if (e.data.ok) {
      renderMatches(e.data.matches, testStr);
    } else {
      showRegexError(e.data.error);
    }
  };
  rxWorker.onerror = (err) => {
    if (requestId !== rxRequestId) return;
    clearTimeout(rxTimeoutHandle);
    showRegexError(err.message || 'Something went wrong while matching.');
  };

  rxWorker.postMessage({ pattern, flags, testStr, findAll });
}

function showRegexError(msg) {
  document.getElementById('regexHighlighted').innerHTML = '';
  document.getElementById('rxMeta').innerHTML = `<div class="callout error">${escapeHtml(msg || 'Something went wrong while matching.')}</div>`;
  document.getElementById('rxGroups').innerHTML = '';
}

function renderMatches(matches, testStr) {
  const highlightDiv = document.getElementById('regexHighlighted');
  const metaDiv = document.getElementById('rxMeta');
  const groupsDiv = document.getElementById('rxGroups');

  let html = '';
  let lastIndex = 0;
  matches.forEach((m, idx) => {
    html += escapeHtml(testStr.slice(lastIndex, m.index));
    html += `<mark class="${idx % 2 ? 'alt' : ''}">${escapeHtml(m.value)}</mark>`;
    lastIndex = m.index + m.value.length;
  });
  html += escapeHtml(testStr.slice(lastIndex));
  highlightDiv.innerHTML = html || '<span class="empty">No matches.</span>';

  metaDiv.innerHTML = `<div class="callout ${matches.length ? 'ok' : 'warn'}" style="margin-top:14px;">${matches.length} match${matches.length === 1 ? '' : 'es'} found.</div>`;

  if (matches.length && matches.some(m => m.captures.length > 0)) {
    // A named capture group's value lands in *both* m.captures (by numeric
    // position) and m.groups (by name) -- listing both unconditionally
    // showed every named group twice with identical values. Group names
    // are looked up by position so each capture is listed exactly once,
    // under its name when it has one.
    const groupNames = getCapturingGroupNames(document.getElementById('rxPattern').value);
    let rows = [];
    matches.forEach((m, mi) => {
      m.captures.forEach((c, gi) => {
        if (c === undefined) return;
        const label = groupNames[gi] ? `match ${mi+1}, ${groupNames[gi]}` : `match ${mi+1}, group ${gi+1}`;
        rows.push({k: label, v: c});
      });
    });
    groupsDiv.innerHTML = rows.length ? `
      <div class="config-block" style="margin-top:14px;">
        <div class="tab">capture groups</div>
        <div class="result-list">${rows.map(r => `<div class="result-item"><span class="k">${escapeHtml(r.k)}</span><span class="v">${escapeHtml(r.v)}</span></div>`).join('')}</div>
      </div>` : '';
  } else {
    groupsDiv.innerHTML = '';
  }

  updateCodeGen();
}

function tryRegexExample() {
  document.getElementById('rxPattern').value = '(?<code>[A-Z]{3})-(?<num>\\d{4})';
  document.getElementById('rxTestString').value = 'Order ABC-1234 shipped. Order XYZ-5678 pending. Invalid: AB-99.';
  runRegex();
}

function clearRegexInputs() {
  document.getElementById('rxPattern').value = '';
  document.getElementById('rxTestString').value = '';
  runRegex();
}

let activeTab = 'cs';
function showTab(lang) {
  activeTab = lang;
  updateCodeGen();
}

function updateCodeGen() {
  const pattern = document.getElementById('rxPattern').value || '';
  const pre = document.getElementById('codeGen');
  if (!pre) return;

  const escapedPattern = pattern.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  
  let code = '';
  if (activeTab === 'cs') {
    const ignoreCase = document.getElementById('rxIgnoreCase').checked;
    const multiline = document.getElementById('rxMultiline').checked;
    const singleline = document.getElementById('rxSingleline').checked;
    
    let options = [];
    if (ignoreCase) options.push('RegexOptions.IgnoreCase');
    if (multiline) options.push('RegexOptions.Multiline');
    if (singleline) options.push('RegexOptions.Singleline');
    
    const optStr = options.length ? `, ${options.join(' | ')}` : '';
    code = `using System.Text.RegularExpressions;\n\n// Instantiation\nvar rx = new Regex(@"${pattern.replace(/"/g, '""')}"${optStr});\n\n// Match validation\nbool isMatch = rx.IsMatch(text);\n\n// Extracting matches\nvar matches = rx.Matches(text);\nforeach (Match match in matches)\n{\n    Console.WriteLine(match.Value);\n}`;
  } else {
    const ignoreCase = document.getElementById('rxIgnoreCase').checked;
    const multiline = document.getElementById('rxMultiline').checked;
    const singleline = document.getElementById('rxSingleline').checked;
    const global = document.getElementById('rxGlobal').checked;
    
    let flags = '';
    if (ignoreCase) flags += 'i';
    if (multiline) flags += 'm';
    if (singleline) flags += 's';
    if (global) flags += 'g';
    
    code = `// Instantiation\nconst rx = /${pattern.replace(/\//g, '\\/')}/${flags};\n\n// Match validation\nconst isMatch = rx.test(text);\n\n// Extracting matches\nconst matches = text.match(rx);\nconsole.log(matches);`;
  }
  pre.textContent = code;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Regex explanation ──────────────────────────────────────────────
function tokenizeRegex(pattern) {
  const tokens = [];
  let i = 0;
  const n = pattern.length;

  while (i < n) {
    const ch = pattern[i];

    // Escape sequences
    if (ch === '\\') {
      const nx = pattern[i + 1];
      if (!nx) { tokens.push({ token: '\\', type: 'error', desc: 'Trailing backslash — invalid pattern' }); i++; continue; }
      const escMap = {
        d:'Any digit [0–9]', D:'Any non-digit', w:'Word character [a-zA-Z0-9_]', W:'Non-word character',
        s:'Whitespace (space, tab, newline…)', S:'Non-whitespace',
        b:'Word boundary', B:'Non-word boundary',
        n:'Newline (\\n)', t:'Tab (\\t)', r:'Carriage return (\\r)',
        '0':'Null character', f:'Form feed', v:'Vertical tab',
      };
      if (nx === 'u') {
        const code = pattern.slice(i+2, i+6);
        tokens.push({ token: `\\u${code}`, type: 'escape', desc: `Unicode U+${code.toUpperCase()}` }); i += 6; continue;
      }
      if (nx === 'x') {
        const code = pattern.slice(i+2, i+4);
        tokens.push({ token: `\\x${code}`, type: 'escape', desc: `Hex character 0x${code.toUpperCase()}` }); i += 4; continue;
      }
      if (nx >= '1' && nx <= '9') {
        tokens.push({ token: `\\${nx}`, type: 'escape', desc: `Back-reference to capture group ${nx}` }); i += 2; continue;
      }
      tokens.push({ token: `\\${nx}`, type: escMap[nx] ? 'escape' : 'literal', desc: escMap[nx] || `Escaped literal "${nx}"` });
      i += 2; continue;
    }

    // Anchors
    if (ch === '^') { tokens.push({ token: '^', type: 'anchor', desc: 'Start of string (or line in Multiline mode)' }); i++; continue; }
    if (ch === '$') { tokens.push({ token: '$', type: 'anchor', desc: 'End of string (or line in Multiline mode)' }); i++; continue; }

    // Dot
    if (ch === '.') { tokens.push({ token: '.', type: 'wildcard', desc: 'Any character except newline (or any char in Singleline mode)' }); i++; continue; }

    // Alternation
    if (ch === '|') { tokens.push({ token: '|', type: 'alternation', desc: 'OR — match either the left or right side' }); i++; continue; }

    // Character class [...]
    if (ch === '[') {
      let j = i + 1, raw = '[';
      if (pattern[j] === '^') { raw += '^'; j++; }
      while (j < n) {
        if (pattern[j] === '\\') { raw += pattern[j] + (pattern[j+1] || ''); j += 2; continue; }
        raw += pattern[j];
        if (pattern[j] === ']') { j++; break; }
        j++;
      }
      const neg = raw[1] === '^';
      const inner = neg ? raw.slice(2, -1) : raw.slice(1, -1);
      tokens.push({ token: raw, type: 'class', desc: neg ? `Any character NOT in: ${inner}` : `Any character in: ${inner}` });
      i = j; continue;
    }

    // Groups
    if (ch === '(') {
      let desc = 'Capturing group', advance = 1;
      if (pattern[i+1] === '?') {
        const p2 = pattern[i+2], p3 = pattern[i+3];
        if (p2 === ':')  { desc = 'Non-capturing group'; advance = 3; }
        else if (p2 === '=') { desc = 'Positive lookahead — position must be followed by this'; advance = 3; }
        else if (p2 === '!') { desc = 'Negative lookahead — position must NOT be followed by this'; advance = 3; }
        else if (p2 === '<' && p3 === '=') { desc = 'Positive lookbehind — position must be preceded by this'; advance = 4; }
        else if (p2 === '<' && p3 === '!') { desc = 'Negative lookbehind — position must NOT be preceded by this'; advance = 4; }
        else if (p2 === '<') {
          const end = pattern.indexOf('>', i + 3);
          const name = end > 0 ? pattern.slice(i+3, end) : '?';
          desc = `Named capturing group "${name}"`;
          advance = end > 0 ? end - i + 1 : 3;
        } else { desc = 'Group with inline modifier'; advance = 2; }
      }
      tokens.push({ token: pattern.slice(i, i + advance) + (advance === 1 ? '' : ''), type: 'group', desc }); i += advance; continue;
    }
    if (ch === ')') { tokens.push({ token: ')', type: 'group', desc: 'End of group' }); i++; continue; }

    // {n,m} quantifier
    if (ch === '{') {
      const end = pattern.indexOf('}', i);
      if (end !== -1) {
        const inner = pattern.slice(i+1, end);
        const lazy = pattern[end+1] === '?';
        const mode = lazy ? ' (lazy)' : '';
        let desc;
        if (/^\d+$/.test(inner)) desc = `Exactly ${inner} time${inner==='1'?'':'s'}${mode}`;
        else if (/^\d+,$/.test(inner)) desc = `At least ${inner.slice(0,-1)} times${mode}`;
        else if (/^\d+,\d+$/.test(inner)) { const [a,b] = inner.split(','); desc = `Between ${a} and ${b} times${mode}`; }
        else { tokens.push({ token: ch, type: 'literal', desc: `Literal "{"` }); i++; continue; }
        tokens.push({ token: pattern.slice(i, end+1) + (lazy ? '?' : ''), type: 'quantifier', desc });
        i = end + 1 + (lazy ? 1 : 0); continue;
      }
    }

    // *, +, ? quantifiers
    if ('*+?'.includes(ch)) {
      const lazy = pattern[i+1] === '?';
      const mode = lazy ? ' (lazy — as few as possible)' : ' (greedy — as many as possible)';
      const desc = ch === '*' ? `Zero or more${mode}` : ch === '+' ? `One or more${mode}` : `Zero or one (optional)${mode}`;
      tokens.push({ token: lazy ? ch + '?' : ch, type: 'quantifier', desc }); i += lazy ? 2 : 1; continue;
    }

    // Consecutive literals
    let lit = '';
    while (i < n && !'\\^$.|?*+()[]{}'.includes(pattern[i])) { lit += pattern[i]; i++; }
    if (lit) { tokens.push({ token: lit, type: 'literal', desc: `Literal text "${lit}"` }); continue; }

    // Fallback
    tokens.push({ token: ch, type: 'literal', desc: `Literal "${ch}"` }); i++;
  }
  return tokens;
}

// Capturing-group index -> name (null for an unnamed group), in the same
// left-to-right order the regex engine itself assigns group numbers.
// Reuses tokenizeRegex's own group-boundary detection instead of
// re-parsing the pattern, so it can't disagree with what the explanation
// panel already shows for the same pattern.
function getCapturingGroupNames(pattern) {
  let tokens;
  try { tokens = tokenizeRegex(pattern); } catch (e) { return []; }
  const names = [];
  tokens.forEach(t => {
    if (t.type !== 'group') return;
    if (t.desc === 'Capturing group') names.push(null);
    else if (t.desc.indexOf('Named capturing group') === 0) {
      const m = /"([^"]*)"/.exec(t.desc);
      names.push(m ? m[1] : null);
    }
  });
  return names;
}

const _tokenColors = {
  anchor:'var(--amber)', escape:'var(--violet)', class:'var(--violet)',
  wildcard:'var(--violet)', quantifier:'var(--green)', group:'var(--ink-soft)',
  alternation:'var(--red)', literal:'var(--ink)', error:'var(--red)',
};

function renderExplanation(pattern) {
  if (!pattern) return '';
  let tokens;
  try { tokens = tokenizeRegex(pattern); } catch (e) { return ''; }
  if (!tokens.length) return '';
  return `<div class="rx-explain">${tokens.map(t => `
    <div class="rx-er">
      <code class="rx-tok" style="color:${_tokenColors[t.type]||'var(--ink)'};">${escapeHtml(t.token)}</code>
      <span class="rx-type">${t.type}</span>
      <span class="rx-desc">${escapeHtml(t.desc)}</span>
    </div>`).join('')}</div>`;
}

window.addEventListener('load', function() {
  persistFormState('regex-tester', ['rxIgnoreCase', 'rxMultiline', 'rxSingleline', 'rxGlobal']);
  runRegex();
  updateCodeGen();
});

document.getElementById('rxPattern').addEventListener('input', runRegex);
document.getElementById('rxIgnoreCase').addEventListener('change', runRegex);
document.getElementById('rxMultiline').addEventListener('change', runRegex);
document.getElementById('rxSingleline').addEventListener('change', runRegex);
document.getElementById('rxGlobal').addEventListener('change', runRegex);
document.getElementById('rxTestString').addEventListener('input', runRegex);
document.getElementById('btnRegexExample').addEventListener('click', tryRegexExample);
document.getElementById('btnRegexClear').addEventListener('click', clearRegexInputs);
document.getElementById('btnRegexTabCs').addEventListener('click', function () { showTab('cs'); });
document.getElementById('btnRegexTabJs').addEventListener('click', function () { showTab('js'); });
