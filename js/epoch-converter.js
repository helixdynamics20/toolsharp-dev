function setEpochNow() {
  const now = Math.floor(Date.now() / 1000);
  document.getElementById('epochInput').value = now;
  convertEpoch();
}

function convertEpoch() {
  const val = document.getElementById('epochInput').value.trim();
  if (!val) {
    document.getElementById('isoOutput').value = '';
    document.getElementById('utcOutput').value = '';
    document.getElementById('localOutput').value = '';
    return;
  }

  let num = parseInt(val, 10);
  if (isNaN(num)) {
    document.getElementById('isoOutput').value = 'Invalid timestamp';
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

  document.getElementById('isoOutput').value = d.toISOString();
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


function setEpochFromClock(unit) {
  const now = Date.now();
  document.getElementById('epochInput').value = unit === 'ms' ? now : Math.floor(now / 1000);
  convertEpoch();
}

function updateLiveClock() {
  const now = Date.now();
  const sec = Math.floor(now / 1000);
  const d = new Date(now);
  const elSec = document.getElementById('liveEpochSec');
  const elMs = document.getElementById('liveEpochMs');
  const elUtc = document.getElementById('liveEpochUtc');
  const elLocal = document.getElementById('liveEpochLocal');
  if (elSec) elSec.textContent = sec;
  if (elMs) elMs.textContent = now;
  if (elUtc) elUtc.textContent = d.toUTCString();
  if (elLocal) elLocal.textContent = d.toLocaleTimeString();
}

window.addEventListener('load', function() {
  setPickerToNow();
  setEpochNow();
  updateLiveClock();
  setInterval(updateLiveClock, 1000);
});
