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

function buildCron() {
  const flavor = document.getElementById('cronFlavor').value;
  const freq = document.getElementById('cronFreq').value;
  const val = id => { const el = document.getElementById(id); return el ? el.value : ''; };

  let min = '*', hour = '*', dom = '*', month = '*', dow = flavor === 'quartz' ? '?' : '*';
  let explanation = '';

  if (freq === 'everyMinute') {
    explanation = 'Runs every minute, every hour, every day.';
  } else if (freq === 'everyNMinutes') {
    const n = val('cronN') || '15';
    min = `*/${n}`;
    explanation = `Runs every ${n} minute(s), around the clock, every day.`;
  } else if (freq === 'hourly') {
    min = val('cronMinute') || '0';
    explanation = `Runs once an hour, at minute ${min} of every hour.`;
  } else if (freq === 'daily') {
    hour = val('cronHour') || '0';
    min = val('cronMinute') || '0';
    explanation = `Runs once a day at ${pad(hour)}:${pad(min)}.`;
  } else if (freq === 'weekly') {
    const dowVal = val('cronDow') || '1';
    hour = val('cronHour') || '0';
    min = val('cronMinute') || '0';
    dow = flavor === 'quartz' ? quartzDow(dowVal) : dowVal;
    dom = flavor === 'quartz' ? '?' : '*';
    explanation = `Runs weekly on ${dowName(dowVal)} at ${pad(hour)}:${pad(min)}.`;
  } else if (freq === 'monthly') {
    dom = val('cronDom') || '1';
    hour = val('cronHour') || '0';
    min = val('cronMinute') || '0';
    dow = flavor === 'quartz' ? '?' : '*';
    explanation = `Runs monthly on day ${dom} at ${pad(hour)}:${pad(min)}.`;
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

  document.getElementById('cronExplain').innerHTML = `<div class="callout ok">${explanation}</div>`;
}

function pad(n) { n = String(n); return n.length < 2 ? '0' + n : n; }
function quartzDow(standardDow) {
  // standard: 0=Sun..6=Sat -> quartz: 1=SUN..7=SAT
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

  resultDiv.innerHTML = `<div class="config-block" style="margin-top:18px;"><div class="tab">explanation</div><div class="body"><div class="callout ok">${html}</div></div></div>`;
}

function describeFields(f) {
  let parts = [];
  if (f.hasSeconds) parts.push(f.sec === '0' || f.sec === '*' && false ? '' : (f.sec === '0' ? '' : `at second ${f.sec}`));
  const minDesc = f.min === '*' ? 'every minute' : f.min.startsWith('*/') ? `every ${f.min.slice(2)} minutes` : `at minute ${f.min}`;
  const hourDesc = f.hour === '*' ? 'every hour' : `hour ${f.hour}`;
  const domDesc = (f.dom === '*' || f.dom === '?') ? '' : `on day-of-month ${f.dom}`;
  const monthDesc = f.month === '*' ? '' : `in month ${f.month}`;
  const dowDesc = (f.dow === '*' || f.dow === '?') ? '' : `on day-of-week ${f.dow}`;

  let out = `Runs ${minDesc}, ${hourDesc}`;
  [domDesc, monthDesc, dowDesc].filter(Boolean).forEach(p => out += `, ${p}`);
  out += '.';
  if (f.hasSeconds) out += ' (6/7-field format — treat this as Quartz.NET.)';
  else out += ' (5-field format — treat this as standard/Hangfire cron.)';
  return out;
}
function copyText(id) { navigator.clipboard.writeText(document.getElementById(id).textContent); }
