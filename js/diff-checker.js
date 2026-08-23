function clearDiff() {
  document.getElementById('diffOriginal').value = '';
  document.getElementById('diffChanged').value = '';
  document.getElementById('diffResult').innerHTML = '';
}

function diffArrays(a, b) {
  const n = a.length, m = b.length;
  const dp = Array.from({length: n + 1}, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = (a[i] === b[j]) ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  let i = 0, j = 0;
  const ops = [];
  while (i < n && j < m) {
    if (a[i] === b[j]) { ops.push({type: 'same', item: a[i]}); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) { ops.push({type: 'remove', item: a[i]}); i++; }
    else { ops.push({type: 'add', item: b[j]}); j++; }
  }
  while (i < n) { ops.push({type: 'remove', item: a[i]}); i++; }
  while (j < m) { ops.push({type: 'add', item: b[j]}); j++; }
  return ops;
}

function tokenize(line) {
  return line.match(/\w+|[^\w\s]|\s+/g) || [];
}

function renderModifiedHalf(oldLine, newLine) {
  const tokenOps = diffArrays(tokenize(oldLine), tokenize(newLine));
  let leftHtml = '', rightHtml = '';
  tokenOps.forEach(op => {
    const escaped = escapeHtml(op.item);
    if (op.type === 'same') { leftHtml += escaped; rightHtml += escaped; }
    else if (op.type === 'remove') { leftHtml += `<mark class="tok-remove">${escaped}</mark>`; }
    else { rightHtml += `<mark class="tok-add">${escaped}</mark>`; }
  });
  return { leftHtml, rightHtml };
}

function buildRows(lineOps) {
  const rows = [];
  let i = 0;
  while (i < lineOps.length) {
    if (lineOps[i].type === 'same') {
      rows.push({ type: 'same', left: lineOps[i].item, right: lineOps[i].item });
      i++;
      continue;
    }
    const removeBuf = [], addBuf = [];
    while (i < lineOps.length && lineOps[i].type !== 'same') {
      if (lineOps[i].type === 'remove') removeBuf.push(lineOps[i].item);
      else addBuf.push(lineOps[i].item);
      i++;
    }
    const pairCount = Math.min(removeBuf.length, addBuf.length);
    for (let k = 0; k < pairCount; k++) {
      rows.push({ type: 'modified', left: removeBuf[k], right: addBuf[k] });
    }
    for (let k = pairCount; k < removeBuf.length; k++) rows.push({ type: 'removed', left: removeBuf[k], right: null });
    for (let k = pairCount; k < addBuf.length; k++) rows.push({ type: 'added', left: null, right: addBuf[k] });
  }
  return rows;
}

function runDiff() {
  const origRaw = document.getElementById('diffOriginal').value;
  const changedRaw = document.getElementById('diffChanged').value;
  const ignoreWs = document.getElementById('diffIgnoreWhitespace').checked;
  const resultDiv = document.getElementById('diffResult');

  if (!origRaw && !changedRaw) {
    resultDiv.innerHTML = '<div class="callout warn">Paste something in both boxes first.</div>';
    return;
  }

  let aLines = origRaw.split('\n');
  let bLines = changedRaw.split('\n');
  if (ignoreWs) {
    aLines = aLines.map(l => l.trim());
    bLines = bLines.map(l => l.trim());
  }

  if (aLines.length * bLines.length > 4_000_000) {
    resultDiv.innerHTML = '<div class="callout error">These inputs are too large to diff in-browser (this tool is built for quick checks, not full files). Try a smaller excerpt, or use your editor\'s built-in diff view instead.</div>';
    return;
  }

  const lineOps = diffArrays(aLines, bLines);
  const rows = buildRows(lineOps);

  const removalsCount = rows.filter(r => r.type === 'removed' || r.type === 'modified').length;
  const additionsCount = rows.filter(r => r.type === 'added' || r.type === 'modified').length;

  let leftNo = 1, rightNo = 1;
  const rowsHtml = rows.map(row => {
    let leftContent = '', rightContent = '', leftBg = '', rightBg = '';
    let leftGutter = '', rightGutter = '';

    if (row.type === 'same') {
      leftContent = escapeHtml(row.left);
      rightContent = escapeHtml(row.right);
      leftGutter = leftNo++; rightGutter = rightNo++;
    } else if (row.type === 'modified') {
      const { leftHtml, rightHtml } = renderModifiedHalf(row.left, row.right);
      leftContent = leftHtml; rightContent = rightHtml;
      leftBg = 'bg-remove'; rightBg = 'bg-add';
      leftGutter = leftNo++; rightGutter = rightNo++;
    } else if (row.type === 'removed') {
      leftContent = escapeHtml(row.left);
      leftBg = 'bg-remove'; rightBg = 'empty';
      leftGutter = leftNo++; rightGutter = '';
    } else if (row.type === 'added') {
      rightContent = escapeHtml(row.right);
      leftBg = 'empty'; rightBg = 'bg-add';
      leftGutter = ''; rightGutter = rightNo++;
    }

    return `<div class="diff-row ${row.type}">
      <div class="diff-cell left ${leftBg}"><span class="gutter">${leftGutter}</span><span class="content">${leftContent}</span></div>
      <div class="diff-cell right ${rightBg}"><span class="gutter">${rightGutter}</span><span class="content">${rightContent}</span></div>
    </div>`;
  }).join('');

  resultDiv.innerHTML = `
    <div class="diff-summary-row">
      <div class="diff-summary-side removals">
        <span class="dot"></span> <strong>${removalsCount}</strong> removal${removalsCount === 1 ? '' : 's'} <span class="linecount">${aLines.length} lines</span>
        <button class="copy-btn" onclick="copyOriginal(this)">copy</button>
      </div>
      <div class="diff-summary-side additions">
        <span class="dot"></span> <strong>${additionsCount}</strong> addition${additionsCount === 1 ? '' : 's'} <span class="linecount">${bLines.length} lines</span>
        <button class="copy-btn" onclick="copyChanged(this)">copy</button>
      </div>
    </div>
    <div class="diff-split-body">${rowsHtml}</div>
    ${removalsCount === 0 && additionsCount === 0 ? '<div class="callout ok" style="margin-top:14px;">No differences — the two inputs are identical.</div>' : ''}
  `;
}

function copyOriginal(btn) { navigator.clipboard.writeText(document.getElementById('diffOriginal').value); flashCopied(btn); }
function copyChanged(btn) { navigator.clipboard.writeText(document.getElementById('diffChanged').value); flashCopied(btn); }

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
