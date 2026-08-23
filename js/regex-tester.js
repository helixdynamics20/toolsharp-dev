function runRegex() {
  const pattern = document.getElementById('rxPattern').value;
  const testStr = document.getElementById('rxTestString').value;
  const highlightDiv = document.getElementById('regexHighlighted');
  const metaDiv = document.getElementById('rxMeta');
  const groupsDiv = document.getElementById('rxGroups');

  if (!pattern) {
    highlightDiv.textContent = 'Enter a pattern and test string.';
    highlightDiv.classList.add('empty');
    metaDiv.innerHTML = '';
    groupsDiv.innerHTML = '';
    return;
  }

  let flags = '';
  if (document.getElementById('rxIgnoreCase').checked) flags += 'i';
  if (document.getElementById('rxMultiline').checked) flags += 'm';
  if (document.getElementById('rxSingleline').checked) flags += 's';
  const findAll = document.getElementById('rxGlobal').checked;
  if (findAll) flags += 'g';

  let re;
  try {
    re = new RegExp(pattern, flags);
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

  let matches = [];
  if (findAll) {
    let m;
    const globalRe = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    while ((m = globalRe.exec(testStr)) !== null) {
      matches.push(m);
      if (m[0] === '') globalRe.lastIndex++;
    }
  } else {
    const m = re.exec(testStr);
    if (m) matches.push(m);
  }

  let html = '';
  let lastIndex = 0;
  matches.forEach((m, idx) => {
    html += escapeHtml(testStr.slice(lastIndex, m.index));
    html += `<mark class="${idx % 2 ? 'alt' : ''}">${escapeHtml(m[0])}</mark>`;
    lastIndex = m.index + m[0].length;
  });
  html += escapeHtml(testStr.slice(lastIndex));
  highlightDiv.innerHTML = html || '<span class="empty">No matches.</span>';

  metaDiv.innerHTML = `<div class="callout ${matches.length ? 'ok' : 'warn'}" style="margin-top:14px;">${matches.length} match${matches.length === 1 ? '' : 'es'} found.</div>`;

  if (matches.length && matches.some(m => m.length > 1)) {
    let rows = [];
    matches.forEach((m, mi) => {
      for (let gi = 1; gi < m.length; gi++) {
        if (m[gi] !== undefined) rows.push({k: `match ${mi+1}, group ${gi}`, v: m[gi]});
      }
      if (m.groups) {
        Object.entries(m.groups).forEach(([name, val]) => {
          if (val !== undefined) rows.push({k: `match ${mi+1}, ${name}`, v: val});
        });
      }
    });
    groupsDiv.innerHTML = rows.length ? `
      <div class="config-block" style="margin-top:14px;">
        <div class="tab">capture groups</div>
        <div class="result-list">${rows.map(r => `<div class="result-item"><span class="k">${escapeHtml(r.k)}</span><span class="v">${escapeHtml(r.v)}</span></div>`).join('')}</div>
      </div>` : '';
  } else {
    groupsDiv.innerHTML = '';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
