function setEpochNow() {
  const now = Math.floor(Date.now() / 1000);
  document.getElementById('epochInput').value = now;
  convertEpoch();
}

function convertEpoch() {
  const val = document.getElementById('epochInput').value.trim();
  if (!val) {
    document.getElementById('utcOutput').value = '';
    document.getElementById('localOutput').value = '';
    return;
  }

  let num = parseInt(val, 10);
  if (isNaN(num)) {
    document.getElementById('utcOutput').value = 'Invalid timestamp';
    document.getElementById('localOutput').value = 'Invalid timestamp';
    return;
  }

  // Detect seconds vs milliseconds (millisecond values typically have > 11 digits)
  if (val.length <= 11) {
    num = num * 1000;
  }

  const d = new Date(num);
  if (isNaN(d.getTime())) {
    document.getElementById('utcOutput').value = 'Invalid Date';
    document.getElementById('localOutput').value = 'Invalid Date';
    return;
  }

  document.getElementById('utcOutput').value = d.toUTCString();
  document.getElementById('localOutput').value = d.toString();
}

function convertDateToEpoch() {
  const y = parseInt(document.getElementById('yearIn').value, 10);
  const m = parseInt(document.getElementById('monthIn').value, 10) - 1;
  const d = parseInt(document.getElementById('dayIn').value, 10);
  const h = parseInt(document.getElementById('hourIn').value, 10) || 0;
  const min = parseInt(document.getElementById('minIn').value, 10) || 0;
  const s = parseInt(document.getElementById('secIn').value, 10) || 0;

  if (isNaN(y) || isNaN(m) || isNaN(d)) {
    alert('Please enter at least Year, Month, and Day.');
    return;
  }

  const date = new Date(y, m, d, h, min, s);
  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);

  document.getElementById('epochSecOutput').value = sec;
  document.getElementById('epochMsOutput').value = ms;
}

function copyResult(id, btn) {
  const el = document.getElementById(id);
  if (!el || !el.value) return;
  el.select();
  navigator.clipboard.writeText(el.value);
  flashCopied(btn);
}

// Initialize on load
window.addEventListener('load', function() {
  const d = new Date();
  document.getElementById('yearIn').value = d.getFullYear();
  document.getElementById('monthIn').value = d.getMonth() + 1;
  document.getElementById('dayIn').value = d.getDate();
  document.getElementById('hourIn').value = d.getHours();
  document.getElementById('minIn').value = d.getMinutes();
  document.getElementById('secIn').value = d.getSeconds();
  
  setEpochNow();
  convertDateToEpoch();
});
