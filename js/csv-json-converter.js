// ── shared small helpers (duplicated per-file by convention on this site) ──

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function flashCopied(btn) {
  const orig = btn.textContent;
  btn.textContent = 'copied!';
  setTimeout(() => { btn.textContent = orig; }, 1500);
}

// Syntax-highlight formatted JSON text using the same jt-* color classes
// used by json-formatter.js / json-tree rendering (defined globally in
// css/style.css), so colored JSON looks consistent across tools.
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

// ── CSV parsing: a proper character-by-character state machine ──
// Handles quoted fields, "" as an escaped quote inside a quoted field,
// fields with embedded delimiters/newlines when quoted, and both \n and
// \r\n line endings. Returns an array of rows, each row an array of
// raw string field values (no header handling here).
function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          // escaped quote inside a quoted field: "" -> "
          field += '"';
          i += 2;
          continue;
        }
        // closing quote
        inQuotes = false;
        i++;
        continue;
      }
      // any other character (including newlines) inside quotes is data
      field += c;
      i++;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // treat \r\n as a single line ending
      if (text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // flush the last field/row unless the file ended cleanly on a newline
  // (in which case field and row are both already empty/flushed)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

// Converts parsed CSV rows into an array of objects, using the first row
// as the header/keys. Rows that are a single empty field (blank lines)
// are skipped rather than turned into a spurious record.
function rowsToObjects(rows) {
  const filtered = rows.filter(r => !(r.length === 1 && r[0] === ''));
  if (!filtered.length) return { data: [], duplicateHeaders: [] };
  const header = filtered[0];

  const seen = new Set();
  const duplicateHeaders = [];
  header.forEach(h => {
    if (seen.has(h)) { if (!duplicateHeaders.includes(h)) duplicateHeaders.push(h); }
    seen.add(h);
  });

  const data = filtered.slice(1).map(r => {
    const obj = {};
    header.forEach((h, i) => {
      obj[h] = r[i] !== undefined ? r[i] : '';
    });
    return obj;
  });
  return { data, duplicateHeaders };
}

// ── CSV serialization ──

function csvEscapeField(value, delimiter) {
  const str = value === null || value === undefined ? '' : String(value);
  const needsQuoting = str.includes(delimiter) || str.includes('"') || str.includes('\n') || str.includes('\r');
  if (needsQuoting) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

// Accepts an array of flat objects (not required to share identical keys)
// and produces a CSV string. The header row is the union of every key
// seen across all objects, in first-seen order; missing keys become
// empty cells for that row.
function jsonToCsvString(data, delimiter) {
  if (!Array.isArray(data)) throw new Error('Input must be a JSON array of objects.');
  if (!data.length) return '';

  const keys = [];
  const seen = new Set();
  for (const obj of data) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      throw new Error('Every array element must be a flat JSON object.');
    }
    Object.entries(obj).forEach(([k, v]) => {
      if (v !== null && typeof v === 'object') {
        const kind = Array.isArray(v) ? 'an array' : 'an object';
        throw new Error(`Every array element must be a flat JSON object — "${k}" contains ${kind}, which CSV can't represent as a single cell. Flatten it first (e.g. "${k}.subfield") or remove it.`);
      }
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    });
  }

  const lines = [keys.map(k => csvEscapeField(k, delimiter)).join(delimiter)];
  for (const obj of data) {
    lines.push(keys.map(k => csvEscapeField(obj[k], delimiter)).join(delimiter));
  }
  return lines.join('\r\n');
}

function getDelimiterChar(selectId) {
  const v = document.getElementById(selectId).value;
  return v === 'tab' ? '\t' : v;
}

// ── CSV -> JSON ──

// Each keystroke reparses the whole input with a hand-rolled character-by-
// character CSV parser -- debounce plain typing so a large pasted CSV
// being edited doesn't reparse on every keystroke.
let _csvInputTimer = null;
function scheduleConvertCsvToJson() {
  clearTimeout(_csvInputTimer);
  _csvInputTimer = setTimeout(convertCsvToJson, 200);
}

function convertCsvToJson() {
  const text = document.getElementById('csvInput').value;
  const msgEl = document.getElementById('csvJsonMsg');
  const outEl = document.getElementById('csvJsonOutput');
  msgEl.innerHTML = '';

  if (!text.trim()) {
    outEl.className = 'empty';
    outEl.textContent = 'Result appears here.';
    return;
  }

  try {
    const delimiter = getDelimiterChar('csvDelimiter');
    const rows = parseCsv(text, delimiter);
    const { data, duplicateHeaders } = rowsToObjects(rows);
    const json = JSON.stringify(data, null, 2);
    outEl.className = '';
    outEl.innerHTML = highlightJsonText(json);
    if (!data.length) {
      msgEl.innerHTML = '<div class="callout warn">No data rows found (only a header row, or empty input).</div>';
    } else if (duplicateHeaders.length) {
      msgEl.innerHTML = `<div class="callout warn">Duplicate column header(s): ${duplicateHeaders.map(h => `<code>${escapeHtml(h)}</code>`).join(', ')} — for each duplicate, only the last matching column's value was kept per row.</div>`;
    }
  } catch (e) {
    outEl.className = 'empty';
    outEl.textContent = '';
    msgEl.innerHTML = `<div class="callout error">${escapeHtml(e.message)}</div>`;
  }
}

function tryCsvExample() {
  document.getElementById('csvInput').value = 'name,age,city\nAlice,30,"New York, NY"\nBob,25,Chicago\n"Cara ""CJ"" Diaz",41,"Chicago"';
  document.getElementById('csvDelimiter').value = ',';
  convertCsvToJson();
}

function clearCsvInput() {
  document.getElementById('csvInput').value = '';
  convertCsvToJson();
}

function loadCsvFile(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('csvInput').value = e.target.result;
    if (/\.tsv$/i.test(file.name)) document.getElementById('csvDelimiter').value = 'tab';
    convertCsvToJson();
  };
  reader.readAsText(file);
  inputEl.value = '';
}

// ── JSON -> CSV ──

let _jsonToCsvInputTimer = null;
function scheduleConvertJsonToCsv() {
  clearTimeout(_jsonToCsvInputTimer);
  _jsonToCsvInputTimer = setTimeout(convertJsonToCsv, 200);
}

function convertJsonToCsv() {
  const text = document.getElementById('jsonToCsvInput').value;
  const msgEl = document.getElementById('jsonToCsvMsg');
  const outEl = document.getElementById('jsonToCsvOutput');
  msgEl.innerHTML = '';

  if (!text.trim()) {
    outEl.className = 'empty';
    outEl.textContent = 'Result appears here.';
    return;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    outEl.className = 'empty';
    outEl.textContent = '';
    msgEl.innerHTML = `<div class="callout error">Invalid JSON: ${escapeHtml(e.message)}</div>`;
    return;
  }

  if (!Array.isArray(data)) {
    outEl.className = 'empty';
    outEl.textContent = '';
    msgEl.innerHTML = '<div class="callout error">Input must be a JSON array of objects, e.g. <code>[{"name":"Alice"}]</code>.</div>';
    return;
  }

  if (!data.length) {
    outEl.className = 'empty';
    outEl.textContent = 'Empty array — nothing to convert.';
    msgEl.innerHTML = '<div class="callout warn">The array is empty, so there\'s no header row to derive.</div>';
    return;
  }

  const bad = data.find(o => typeof o !== 'object' || o === null || Array.isArray(o));
  if (bad !== undefined) {
    outEl.className = 'empty';
    outEl.textContent = '';
    const kind = Array.isArray(bad) ? 'an array' : bad === null ? 'null' : typeof bad;
    msgEl.innerHTML = `<div class="callout error">Every array element must be a flat JSON object — found ${escapeHtml(kind)} instead.</div>`;
    return;
  }

  try {
    const delimiter = getDelimiterChar('jsonToCsvDelimiter');
    const csv = jsonToCsvString(data, delimiter);
    outEl.className = '';
    outEl.textContent = csv;

    const keyCounts = new Set();
    data.forEach(o => Object.keys(o).forEach(k => keyCounts.add(k)));
    const inconsistent = data.some(o => Object.keys(o).length !== keyCounts.size);
    if (inconsistent) {
      msgEl.innerHTML = '<div class="callout">Objects had different keys — the header row is the union of all keys; missing values became empty cells.</div>';
    }
  } catch (e) {
    outEl.className = 'empty';
    outEl.textContent = '';
    msgEl.innerHTML = `<div class="callout error">${escapeHtml(e.message)}</div>`;
  }
}

function tryJsonExample() {
  const example = [
    { name: 'Alice', age: 30, city: 'New York, NY' },
    { name: 'Bob', age: 25 },
    { name: 'Cara "CJ" Diaz', age: 41, city: 'Chicago', notes: 'Says "hi"\nand bye' },
  ];
  document.getElementById('jsonToCsvInput').value = JSON.stringify(example, null, 2);
  document.getElementById('jsonToCsvDelimiter').value = ',';
  convertJsonToCsv();
}

function clearJsonInput() {
  document.getElementById('jsonToCsvInput').value = '';
  convertJsonToCsv();
}

function loadJsonFile(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('jsonToCsvInput').value = e.target.result;
    convertJsonToCsv();
  };
  reader.readAsText(file);
  inputEl.value = '';
}

persistFormState('csv-json-converter', ['csvDelimiter', 'jsonToCsvDelimiter']);

// ── copy ──

