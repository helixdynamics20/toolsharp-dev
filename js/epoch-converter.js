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
  const picker = document.getElementById('datetimePicker');
  if (!picker.value) {
    document.getElementById('epochSecOutput').value = '';
    document.getElementById('epochMsOutput').value = '';
    return;
  }

  const date = new Date(picker.value);
  const ms = date.getTime();
  const sec = Math.floor(ms / 1000);

  document.getElementById('epochSecOutput').value = sec;
  document.getElementById('epochMsOutput').value = ms;
}

function setPickerToNow() {
  const d = new Date();
  // Format local date-time string matching datetime-local input (YYYY-MM-DDTHH:mm)
  const offsetMs = d.getTimezoneOffset() * 60000;
  const localISOTime = new Date(d.getTime() - offsetMs).toISOString().slice(0, 16);
  
  document.getElementById('datetimePicker').value = localISOTime;
  convertDateToEpoch();
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
  setPickerToNow();
  setEpochNow();
});
