/* diff-checker.js — ToolSharp.dev */

let currentView = 'split';      // 'split' | 'unified'
let currentPrecision = 'word';  // 'word' | 'char'
let autoTimer = null;

/* ── state controls ── */

function setView(v) {
  currentView = v;
  document.getElementById('btnSplit').classList.toggle('active', v === 'split');
  document.getElementById('btnUnified').classList.toggle('active', v === 'unified');
  runDiff();
}

function setPrecision(p) {
  currentPrecision = p;
  document.getElementById('btnWord').classList.toggle('active', p === 'word');
  document.getElementById('btnChar').classList.toggle('active', p === 'char');
  runDiff();
}

/* ── common prefix/suffix trim ──
   Real-world diffs are almost always "mostly the same file, a few lines
   changed." Trimming the identical head and tail before running the O(n*m)
   LCS table means the expensive part only has to cover the region that
   actually differs, instead of the whole file. */

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLen(a, b, prefixLen) {
  const n = Math.min(a.length, b.length) - prefixLen;
  let i = 0;
  while (i < n && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/* ── LCS diff on arrays ── */

function diffArrays(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = (a[i] === b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  let i = 0, j = 0;
  const ops = [];
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({ type: 'same', item: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { ops.push({ type: 'remove', item: a[i] }); i++; }
    else { ops.push({ type: 'add', item: b[j] }); j++; }
  }
  while (i < n) { ops.push({ type: 'remove', item: a[i++] }); }
  while (j < m) { ops.push({ type: 'add', item: b[j++] }); }
  return ops;
}

/* ── tokenisers ── */

function tokenizeWord(line) { return line.match(/\w+|[^\w\s]|\s+/g) || []; }
function tokenizeChar(line) { return [...line]; }

function tokenize(line) {
  return currentPrecision === 'char' ? tokenizeChar(line) : tokenizeWord(line);
}

/* ── inline-diff rendering ── */

// The file-level size guard in runDiff() only bounds line *count* — a
// single very long line (e.g. one line of minified JS/CSS with no
// newlines) still reaches here and would otherwise run an unbounded O(n*m)
// LCS on tens of thousands of tokens in char-precision mode. Cap it and
// fall back to showing the whole line as changed, without inline
// highlighting, rather than hang the tab on one pathological line.
const INLINE_DIFF_DIM_CAP = 2500;
const INLINE_DIFF_PRODUCT_CAP = 800_000;

function renderInlineDiff(oldLine, newLine) {
  const oldToks = tokenize(oldLine);
  const newToks = tokenize(newLine);
  if (oldToks.length > INLINE_DIFF_DIM_CAP || newToks.length > INLINE_DIFF_DIM_CAP ||
      oldToks.length * newToks.length > INLINE_DIFF_PRODUCT_CAP) {
    return { left: escapeHtml(oldLine), right: escapeHtml(newLine) };
  }
  const ops = diffArrays(oldToks, newToks);
  let left = '', right = '';
  for (const op of ops) {
    const e = escapeHtml(op.item);
    if (op.type === 'same') { left += e; right += e; }
    else if (op.type === 'remove') left += `<mark class="tok-remove">${e}</mark>`;
    else right += `<mark class="tok-add">${e}</mark>`;
  }
  return { left, right };
}

/* ── build logical rows from line ops ── */

function buildRows(lineOps) {
  const rows = [];
  let i = 0;
  while (i < lineOps.length) {
    if (lineOps[i].type === 'same') {
      rows.push({ type: 'same', left: lineOps[i].item, right: lineOps[i].item });
      i++; continue;
    }
    const removes = [], adds = [];
    while (i < lineOps.length && lineOps[i].type !== 'same') {
      if (lineOps[i].type === 'remove') removes.push(lineOps[i].item);
      else adds.push(lineOps[i].item);
      i++;
    }
    const pairs = Math.min(removes.length, adds.length);
    for (let k = 0; k < pairs; k++)
      rows.push({ type: 'modified', left: removes[k], right: adds[k] });
    for (let k = pairs; k < removes.length; k++)
      rows.push({ type: 'removed', left: removes[k], right: null });
    for (let k = pairs; k < adds.length; k++)
      rows.push({ type: 'added', left: null, right: adds[k] });
  }
  return rows;
}

/* ── split view HTML ── */

function renderSplit(rows, hideUnchanged) {
  let leftNo = 1, rightNo = 1;
  const CONTEXT = 3; // unchanged lines to show around changes
  const changed = new Set();
  rows.forEach((r, idx) => { if (r.type !== 'same') changed.add(idx); });

  const visible = new Set();
  rows.forEach((_, idx) => {
    if (changed.has(idx)) {
      for (let d = -CONTEXT; d <= CONTEXT; d++) {
        const t = idx + d;
        if (t >= 0 && t < rows.length) visible.add(t);
      }
    }
    if (!hideUnchanged) visible.add(idx);
  });

  const chunks = [];
  let prev = -1;
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    const ln = leftNo, rn = rightNo;
    if (row.type === 'same') { leftNo++; rightNo++; }
    else if (row.type === 'modified') { leftNo++; rightNo++; }
    else if (row.type === 'removed') { leftNo++; }
    else { rightNo++; }

    if (!visible.has(idx)) {
      if (prev !== idx - 1 || chunks.length === 0 || chunks[chunks.length - 1].type !== 'ellipsis') {
        chunks.push({ type: 'ellipsis', idx });
      } else {
        chunks[chunks.length - 1].count = (chunks[chunks.length - 1].count || 1) + 1;
      }
      prev = idx; continue;
    }

    let leftContent = '', rightContent = '', leftBg = '', rightBg = '';
    let leftGutter = ln - (row.type === 'added' ? 1 : 0);
    let rightGutter = rn - (row.type === 'removed' ? 1 : 0);

    if (row.type === 'same') {
      leftContent = escapeHtml(row.left); rightContent = escapeHtml(row.right);
      leftGutter = ln; rightGutter = rn;
    } else if (row.type === 'modified') {
      const { left, right } = renderInlineDiff(row.left, row.right);
      leftContent = left; rightContent = right;
      leftBg = 'bg-remove'; rightBg = 'bg-add';
      leftGutter = ln; rightGutter = rn;
    } else if (row.type === 'removed') {
      leftContent = escapeHtml(row.left);
      leftBg = 'bg-remove'; rightBg = 'empty';
      leftGutter = ln; rightGutter = '';
    } else {
      rightContent = escapeHtml(row.right);
      leftBg = 'empty'; rightBg = 'bg-add';
      leftGutter = ''; rightGutter = rn;
    }

    chunks.push({ type: 'row', html: `<div class="diff-row">
      <div class="diff-cell left ${leftBg}"><span class="gutter">${leftGutter}</span><span class="content">${leftContent}</span></div>
      <div class="diff-cell right ${rightBg}"><span class="gutter">${rightGutter}</span><span class="content">${rightContent}</span></div>
    </div>` });
    prev = idx;
  }

  const html = chunks.map(c => {
    if (c.type === 'row') return c.html;
    const n = c.count || 1;
    return `<div class="diff-hidden-lines" onclick="expandSection(this, ${c.idx}, ${n})" data-idx="${c.idx}" data-count="${n}">… ${n} unchanged line${n === 1 ? '' : 's'} — click to expand</div>`;
  }).join('');

  return `<div class="diff-split-body">${html || '<div style="padding:16px;font-family:var(--mono);font-size:13px;color:var(--ink-faint);">No changes — the texts are identical.</div>'}</div>`;
}

/* ── unified view HTML ── */

function renderUnified(rows, hideUnchanged) {
  let leftNo = 1, rightNo = 1;
  const CONTEXT = 3;
  const changed = new Set();
  rows.forEach((r, idx) => { if (r.type !== 'same') changed.add(idx); });

  const visible = new Set();
  rows.forEach((_, idx) => {
    if (changed.has(idx)) {
      for (let d = -CONTEXT; d <= CONTEXT; d++) {
        const t = idx + d;
        if (t >= 0 && t < rows.length) visible.add(t);
      }
    }
    if (!hideUnchanged) visible.add(idx);
  });

  const lines = [];
  let hiddenCount = 0;
  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (!visible.has(idx)) { hiddenCount++; continue; }
    if (hiddenCount > 0) {
      lines.push(`<div class="diff-hidden-lines">… ${hiddenCount} unchanged line${hiddenCount === 1 ? '' : 's'}</div>`);
      hiddenCount = 0;
    }

    if (row.type === 'same') {
      lines.push(`<div class="unified-row ur-same"><span class="sign"> </span><span class="u-gutter">${leftNo}</span><span class="u-content">${escapeHtml(row.left)}</span></div>`);
      leftNo++; rightNo++;
    } else if (row.type === 'modified') {
      const { left, right } = renderInlineDiff(row.left, row.right);
      lines.push(`<div class="unified-row ur-remove"><span class="sign">−</span><span class="u-gutter">${leftNo}</span><span class="u-content">${left}</span></div>`);
      lines.push(`<div class="unified-row ur-add"><span class="sign">+</span><span class="u-gutter">${rightNo}</span><span class="u-content">${right}</span></div>`);
      leftNo++; rightNo++;
    } else if (row.type === 'removed') {
      lines.push(`<div class="unified-row ur-remove"><span class="sign">−</span><span class="u-gutter">${leftNo}</span><span class="u-content">${escapeHtml(row.left)}</span></div>`);
      leftNo++;
    } else {
      lines.push(`<div class="unified-row ur-add"><span class="sign">+</span><span class="u-gutter">${rightNo}</span><span class="u-content">${escapeHtml(row.right)}</span></div>`);
      rightNo++;
    }
  }
  if (hiddenCount > 0) lines.push(`<div class="diff-hidden-lines">… ${hiddenCount} unchanged line${hiddenCount === 1 ? '' : 's'}</div>`);

  return `<div class="diff-split-body">${lines.join('') || '<div style="padding:16px;font-family:var(--mono);font-size:13px;color:var(--ink-faint);">No changes — the texts are identical.</div>'}</div>`;
}

/* ── main diff runner ── */

function runDiff() {
  const origRaw = document.getElementById('diffOriginal').value;
  const changedRaw = document.getElementById('diffChanged').value;
  const hideUnchanged = document.getElementById('chkHideUnchanged').checked;
  const ignoreWs = document.getElementById('chkIgnoreWs').checked;
  const resultDiv = document.getElementById('diffResult');

  if (!origRaw && !changedRaw) { resultDiv.innerHTML = ''; return; }

  if (!origRaw || !changedRaw) {
    resultDiv.innerHTML = '<div class="callout warn">Paste content into both boxes to compare.</div>';
    return;
  }

  let aLines = origRaw.split('\n');
  let bLines = changedRaw.split('\n');
  if (ignoreWs) { aLines = aLines.map(l => l.trim()); bLines = bLines.map(l => l.trim()); }

  const prefixLen = commonPrefixLen(aLines, bLines);
  const suffixLen = commonSuffixLen(aLines, bLines, prefixLen);
  const aMid = aLines.slice(prefixLen, aLines.length - suffixLen);
  const bMid = bLines.slice(prefixLen, bLines.length - suffixLen);

  /* The product cap alone lets a lopsided shape slip through (e.g. one
     side with 16,000,000 lines, the other with 1 — same product as a
     balanced 4000x4000, but diffArrays allocates one Int32Array per row
     of the longer side, so a huge single dimension is its own hazard
     regardless of the product). Cap each dimension too. */
  const DIM_CAP = 20_000;
  if (aMid.length > DIM_CAP || bMid.length > DIM_CAP || aMid.length * bMid.length > 16_000_000) {
    resultDiv.innerHTML = '<div class="callout error">The changed region is too large to diff in-browser (~4 000 differing lines each side — identical leading/trailing lines don\'t count against this). Paste a smaller excerpt, or use your editor\'s built-in diff view.</div>';
    return;
  }

  const lineOps = [
    ...aLines.slice(0, prefixLen).map(item => ({ type: 'same', item })),
    ...diffArrays(aMid, bMid),
    ...aLines.slice(aLines.length - suffixLen).map(item => ({ type: 'same', item })),
  ];
  const rows = buildRows(lineOps);

  const removalsCount = rows.filter(r => r.type === 'removed' || r.type === 'modified').length;
  const additionsCount = rows.filter(r => r.type === 'added' || r.type === 'modified').length;

  const summaryHtml = `
    <div class="diff-summary-row">
      <div class="diff-summary-side removals">
        <span class="dot"></span>
        <strong>${removalsCount}</strong> removal${removalsCount === 1 ? '' : 's'}
        <span class="linecount">&nbsp;·&nbsp;${aLines.length} line${aLines.length === 1 ? '' : 's'}</span>
        <button class="copy-btn" onclick="copyElementValue('diffOriginal', this)">copy</button>
      </div>
      <div class="diff-summary-side additions">
        <span class="dot"></span>
        <strong>${additionsCount}</strong> addition${additionsCount === 1 ? '' : 's'}
        <span class="linecount">&nbsp;·&nbsp;${bLines.length} line${bLines.length === 1 ? '' : 's'}</span>
        <button class="copy-btn" onclick="copyElementValue('diffChanged', this)">copy</button>
      </div>
    </div>`;

  const bodyHtml = currentView === 'unified'
    ? renderUnified(rows, hideUnchanged)
    : renderSplit(rows, hideUnchanged);

  const identicalNote = (removalsCount === 0 && additionsCount === 0)
    ? '<div class="callout ok" style="margin-top:12px;">No differences — the two inputs are identical.</div>'
    : '';

  resultDiv.innerHTML = summaryHtml + bodyHtml + identicalNote;
}

/* ── expand hidden section (split view) ── */

function expandSection(el, startIdx, count) {
  /* rebuild without hideUnchanged for now — simplest safe approach */
  document.getElementById('chkHideUnchanged').checked = false;
  runDiff();
}

/* ── swap sides ── */

function swapDiffSides() {
  const orig = document.getElementById('diffOriginal');
  const changed = document.getElementById('diffChanged');
  const tmp = orig.value;
  orig.value = changed.value;
  changed.value = tmp;
  if (document.getElementById('chkAuto').checked) runDiff();
}

/* ── clear ── */

function clearDiff() {
  document.getElementById('diffOriginal').value = '';
  document.getElementById('diffChanged').value = '';
  document.getElementById('diffResult').innerHTML = '';
}

/* ── try example ── */

function tryExample() {
  document.getElementById('diffOriginal').value =
`[database]
host = localhost
port = 5432
name = myapp_dev
pool_size = 5

[cache]
backend = memcached
host = localhost
port = 11211
timeout = 300

[logging]
level = DEBUG
file = /var/log/myapp.log`;

  document.getElementById('diffChanged').value =
`[database]
host = db.prod.internal
port = 5432
name = myapp_prod
pool_size = 20
ssl = true

[cache]
backend = redis
host = cache.prod.internal
port = 6379
timeout = 600

[logging]
level = WARN
file = /var/log/myapp.log
json_format = true`;

  runDiff();
}

/* ── file loading ── */

function loadFile(inputEl, targetId) {
  const file = inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById(targetId).value = e.target.result;
    if (document.getElementById('chkAuto').checked) scheduleAuto();
  };
  reader.readAsText(file);
  inputEl.value = '';
}

/* ── auto-compare (debounced) ── */

function scheduleAuto() {
  if (!document.getElementById('chkAuto').checked) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(runDiff, 400);
}

/* ── escape ── */

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

/* ── init ── */

document.addEventListener('DOMContentLoaded', () => {
  const orig = document.getElementById('diffOriginal');
  const changed = document.getElementById('diffChanged');
  orig.addEventListener('input', scheduleAuto);
  changed.addEventListener('input', scheduleAuto);

  document.getElementById('chkHideUnchanged').addEventListener('change', runDiff);
  document.getElementById('chkIgnoreWs').addEventListener('change', runDiff);
  document.getElementById('chkAuto').addEventListener('change', () => {
    if (document.getElementById('chkAuto').checked) runDiff();
  });

  document.getElementById('fileLeft').addEventListener('change', e => loadFile(e.target, 'diffOriginal'));
  document.getElementById('fileRight').addEventListener('change', e => loadFile(e.target, 'diffChanged'));
});
