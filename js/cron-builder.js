function onFreqChange() {
  const freq = document.getElementById('cronFreq').value;
  const container = document.getElementById('cronExtraFields');
  container.innerHTML = '';

  function addField(label, id, type, placeholder, colSpanFull) {
    const div = document.createElement('div');
    div.className = 'field';
    if (colSpanFull) div.style.gridColumn = '1 / -1';
    div.innerHTML = `<label><span class="key">${label}</span></label><input type="${type}" id="${id}" placeholder="${placeholder}">`;
    container.appendChild(div);
  }
  function addSelect(label, id, options) {
    const div = document.createElement('div');
    div.className = 'field';
    div.innerHTML = `<label><span class="key">${label}</span></label><select id="${id}">${options.map(o=>`<option value="${o.v}">${o.l}</option>`).join('')}</select>`;
    container.appendChild(div);
  }

  if (freq === 'everyNMinutes') {
    addField('Every N minutes', 'cronN', 'number', 'e.g. 15', true);
  } else if (freq === 'hourly') {
    addField('At minute', 'cronMinute', 'number', '0-59', true);
  } else if (freq === 'daily') {
    addField('Hour (0-23)', 'cronHour', 'number', 'e.g. 2');
    addField('Minute (0-59)', 'cronMinute', 'number', 'e.g. 30');
  } else if (freq === 'weekly') {
    addSelect('Day of week', 'cronDow', [
      {v:1,l:'Monday'},{v:2,l:'Tuesday'},{v:3,l:'Wednesday'},{v:4,l:'Thursday'},{v:5,l:'Friday'},{v:6,l:'Saturday'},{v:0,l:'Sunday'}
    ]);
    addField('Hour (0-23)', 'cronHour', 'number', 'e.g. 6');
    addField('Minute (0-59)', 'cronMinute', 'number', 'e.g. 0', true);
  } else if (freq === 'monthly') {
    addField('Day of month (1-31)', 'cronDom', 'number', 'e.g. 1');
    addField('Hour (0-23)', 'cronHour', 'number', 'e.g. 3');
    addField('Minute (0-59)', 'cronMinute', 'number', 'e.g. 0', true);
  }
}
onFreqChange();

function clampField(id, min, max) {
  const el = document.getElementById(id);
  if (!el) return null;
  const v = parseInt(el.value, 10);
  if (isNaN(v)) return el.value || null;
  if (v < min || v > max) {
    el.style.borderColor = 'var(--red)';
    return null;
  }
  el.style.borderColor = '';
  return String(v);
}

function buildCron() {
  const flavor = document.getElementById('cronFlavor').value;
  const freq = document.getElementById('cronFreq').value;
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  let min = '*', hour = '*', dom = '*', month = '*', dow = flavor === 'quartz' ? '?' : '*';
  let explanation = '';
  let validationError = '';

  if (freq === 'everyMinute') {
    explanation = 'Runs every minute, every hour, every day.';
  } else if (freq === 'everyNMinutes') {
    const n = clampField('cronN', 1, 59);
    if (n === null) { validationError = 'Interval must be 1–59.'; }
    else { min = `*/${n}`; explanation = `Runs every ${n} minute(s), around the clock, every day.`; }
  } else if (freq === 'hourly') {
    const m = clampField('cronMinute', 0, 59);
    if (m === null) { validationError = 'Minute must be 0–59.'; }
    else { min = m; explanation = `Runs once an hour, at minute ${min} of every hour.`; }
  } else if (freq === 'daily') {
    const h = clampField('cronHour', 0, 23);
    const m = clampField('cronMinute', 0, 59);
    if (h === null || m === null) { validationError = 'Hour must be 0–23 and minute must be 0–59.'; }
    else { hour = h; min = m; explanation = `Runs once a day at ${pad(hour)}:${pad(min)}.`; }
  } else if (freq === 'weekly') {
    const dowVal = val('cronDow') || '1';
    const h = clampField('cronHour', 0, 23);
    const m = clampField('cronMinute', 0, 59);
    if (h === null || m === null) { validationError = 'Hour must be 0–23 and minute must be 0–59.'; }
    else {
      hour = h; min = m;
      dow = flavor === 'quartz' ? quartzDow(dowVal) : dowVal;
      dom = flavor === 'quartz' ? '?' : '*';
      explanation = `Runs weekly on ${dowName(dowVal)} at ${pad(hour)}:${pad(min)}.`;
    }
  } else if (freq === 'monthly') {
    const d = clampField('cronDom', 1, 31);
    const h = clampField('cronHour', 0, 23);
    const m = clampField('cronMinute', 0, 59);
    if (d === null || h === null || m === null) { validationError = 'Day must be 1–31, hour 0–23, minute 0–59.'; }
    else {
      dom = d; hour = h; min = m;
      dow = flavor === 'quartz' ? '?' : '*';
      explanation = `Runs monthly on day ${dom} at ${pad(hour)}:${pad(min)}.`;
    }
  }

  if (validationError) {
    document.getElementById('cronExplain').innerHTML = `<div class="callout error">${validationError}</div>`;
    return;
  }

  let expr;
  if (flavor === 'quartz') {
    expr = `0 ${min} ${hour} ${dom} ${month} ${dow}`;
  } else {
    expr = `${min} ${hour} ${dom} ${month} ${dow}`;
  }

  const out = document.getElementById('cronOutput');
  out.textContent = expr;
  out.classList.remove('empty');

  const nextRuns = getNextRuns(expr, 5);
  const nextHtml = nextRuns.length ? `<div style="margin-top:10px; font-family:var(--mono); font-size:12.5px; color:var(--ink-soft);">Next ${nextRuns.length} runs:<br>${nextRuns.map(d => '  ' + formatRun(d)).join('<br>')}</div>` : '';
  document.getElementById('cronExplain').innerHTML = `<div class="callout ok">${explanation}${nextHtml}</div>`;
}

function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function quartzDow(standardDow) {
  return (parseInt(standardDow, 10) + 1).toString();
}
function dowName(v) {
  const names = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  return names[parseInt(v,10)] || v;
}

function explainPasted() {
  const input = document.getElementById('cronParseInput').value.trim();
  const resultDiv = document.getElementById('cronPastedResult');
  if (!input) { resultDiv.innerHTML = ''; return; }

  const fields = input.split(/\s+/);
  let html = '';

  if (fields.length === 5) {
    const [min, hour, dom, month, dow] = fields;
    html = describeFields({min, hour, dom, month, dow, hasSeconds:false});
  } else if (fields.length === 6 || fields.length === 7) {
    const [sec, min, hour, dom, month, dow] = fields;
    html = describeFields({sec, min, hour, dom, month, dow, hasSeconds:true});
  } else {
    resultDiv.innerHTML = `<div class="callout error" style="margin-top:14px;">That's ${fields.length} field(s) — standard cron (Hangfire) needs 5, Quartz.NET needs 6 or 7. Double check you copied the whole expression.</div>`;
    return;
  }

  const nextRuns = getNextRuns(input, 5);
  const nextHtml = nextRuns.length ? `<div style="margin-top:10px; font-family:var(--mono); font-size:12.5px; color:var(--ink-soft);">Next ${nextRuns.length} runs:<br>${nextRuns.map(d => '  ' + formatRun(d)).join('<br>')}</div>` : '';
  resultDiv.innerHTML = `<div class="config-block" style="margin-top:18px;"><div class="tab">explanation</div><div class="body"><div class="callout ok">${html}${nextHtml}</div></div></div>`;
}

function describeFieldValue(name, value) {
  if (value === '*') return 'every ' + name;
  if (value === '?') return 'any (wildcard)';
  if (value.startsWith('*/')) return 'every ' + value.slice(2) + ' ' + name + (parseInt(value.slice(2)) > 1 ? 's' : '');
  if (/^\d+$/.test(value)) {
    if (name === 'minute') return 'at :' + String(value).padStart(2, '0');
    if (name === 'hour') return 'at ' + String(value).padStart(2, '0') + ':xx';
    if (name === 'second') return 'at second ' + value;
    if (name === 'month') return 'in ' + (['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+value] || 'month ' + value);
    if (name === 'day-of-week') return 'on ' + (['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][+value] || 'day ' + value);
    return 'on day ' + value;
  }
  if (value.includes('-')) { const [a, b] = value.split('-'); return `${a} through ${b}`; }
  if (value.includes(',')) return 'at ' + value;
  return value;
}

function describeFields(f) {
  const flavor = f.hasSeconds ? 'Quartz.NET (6-field)' : 'Hangfire / standard (5-field)';
  const rows = [];
  if (f.hasSeconds) rows.push({ field: 'second', value: f.sec, desc: describeFieldValue('second', f.sec) });
  rows.push({ field: 'minute',     value: f.min,   desc: describeFieldValue('minute', f.min) });
  rows.push({ field: 'hour',       value: f.hour,  desc: describeFieldValue('hour', f.hour) });
  rows.push({ field: 'day-of-month', value: f.dom, desc: describeFieldValue('day-of-month', f.dom) });
  rows.push({ field: 'month',      value: f.month, desc: describeFieldValue('month', f.month) });
  rows.push({ field: 'day-of-week', value: f.dow,  desc: describeFieldValue('day-of-week', f.dow) });

  const minDesc = f.min === '*' ? 'every minute' : f.min.startsWith('*/') ? `every ${f.min.slice(2)} minutes` : `at minute ${f.min}`;
  const hourDesc = f.hour === '*' ? 'around the clock' : `at hour ${f.hour}`;
  const domDesc = (f.dom === '*' || f.dom === '?') ? '' : `, day ${f.dom} of the month`;
  const monthDesc = f.month === '*' ? '' : `, in month ${f.month}`;
  const dowDesc = (f.dow === '*' || f.dow === '?') ? '' : `, on day-of-week ${f.dow}`;
  const summary = `Runs ${minDesc}, ${hourDesc}${domDesc}${monthDesc}${dowDesc}.`;

  const tableRows = rows.map(r =>
    `<div style="display:flex;gap:10px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.06);font-family:var(--mono);font-size:12px;">` +
    `<span style="width:110px;flex-shrink:0;color:var(--ink-faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;padding-top:2px;">${r.field}</span>` +
    `<code style="width:60px;flex-shrink:0;color:var(--violet);">${r.value}</code>` +
    `<span style="color:var(--ink-soft);">${r.desc}</span></div>`
  ).join('');

  return `<div style="margin-bottom:8px;">${summary} <span style="color:var(--ink-faint);font-size:11px;">(${flavor})</span></div>` +
         `<div style="border:1px solid rgba(255,255,255,0.08);border-radius:4px;padding:8px 12px;margin-top:6px;">${tableRows}</div>`;
}
function matchesField(field, value) {
  if (field === '*' || field === '?') return true;
  return field.split(',').some(part => {
    if (part.includes('/')) {
      const [range, step] = part.split('/');
      const s = parseInt(step, 10);
      if (range === '*') return value % s === 0;
      const start = parseInt(range, 10);
      return value >= start && (value - start) % s === 0;
    }
    if (part.includes('-')) {
      const [lo, hi] = part.split('-').map(Number);
      return value >= lo && value <= hi;
    }
    return parseInt(part, 10) === value;
  });
}

function getNextRuns(expr, count) {
  const fields = expr.trim().split(/\s+/);
  let minF, hourF, domF, monF, dowF;
  if (fields.length === 5) {
    [minF, hourF, domF, monF, dowF] = fields;
  } else if (fields.length >= 6) {
    [, minF, hourF, domF, monF, dowF] = fields;
  } else return [];

  const results = [];
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), now.getMinutes() + 1, 0, 0);

  for (let i = 0; i < 525960 && results.length < count; i++) {
    const m = d.getMinutes(), h = d.getHours(), dom = d.getDate(), mon = d.getMonth() + 1, dow = d.getDay();
    if (matchesField(minF, m) && matchesField(hourF, h) && matchesField(domF, dom) && matchesField(monF, mon) && matchesField(dowF, dow)) {
      results.push(new Date(d));
    }
    d.setMinutes(d.getMinutes() + 1);
  }
  return results;
}

function formatRun(d) {
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  return `${days[d.getDay()]} ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function copyText(id, btn) { navigator.clipboard.writeText(document.getElementById(id).textContent); flashCopied(btn); }
