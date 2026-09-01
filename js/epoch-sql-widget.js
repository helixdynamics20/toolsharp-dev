// Live T-SQL DATEDIFF_BIG/DATEADD worked example for the epoch guide's SQL
// Server section -- computes real numbers from whatever date is picked,
// instead of leaving the reader to trust an abstract example. Progressive
// enhancement: the markup ships with static fallback text, so the guide
// still reads correctly with JS off, it just doesn't compute live.
(function () {
  var picker = document.getElementById('sqlEpochPicker');
  if (!picker) return;

  var nowBtn = document.getElementById('sqlEpochNowBtn');
  var bigMsEl = document.getElementById('sqlEpochBigMs');
  var overflowEl = document.getElementById('sqlEpochOverflow');
  var roundtripEl = document.getElementById('sqlEpochRoundtrip');

  var INT_MAX = 2147483647;
  var INT_MIN = -2147483648;

  // datetime-local wants "YYYY-MM-DDTHH:mm:ss" with no timezone suffix --
  // build that string directly from UTC fields so the picker's own display
  // matches what we're actually treating it as (UTC), not the browser's
  // local time.
  function toDatetimeLocalUtc(date) {
    function pad(n, len) {
      var s = String(n);
      while (s.length < (len || 2)) s = '0' + s;
      return s;
    }
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) +
      'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds());
  }

  function setToNow() {
    picker.value = toDatetimeLocalUtc(new Date());
    recompute();
  }

  function recompute() {
    if (!picker.value) return;
    // The picker's value has no timezone info; appending 'Z' tells Date to
    // parse it as UTC instead of the browser's local zone, matching the
    // "Date & Time (UTC)" label above the field.
    var date = new Date(picker.value + 'Z');
    if (isNaN(date.getTime())) return;

    var ms = date.getTime();
    var seconds = Math.floor(ms / 1000);

    bigMsEl.textContent = String(ms);

    if (ms > INT_MAX || ms < INT_MIN) {
      overflowEl.textContent = 'would overflow (Msg 535) -- this value is ' +
        Math.round(Math.abs(ms - (ms > 0 ? INT_MAX : INT_MIN)) / 86400000 * 10) / 10 +
        ' days past the int range DATEDIFF needs DATEDIFF_BIG for';
    } else {
      overflowEl.textContent = 'would actually work here -- this instant is within 24.85 days of 1970-01-01';
    }

    var reconstructed = new Date(seconds * 1000);
    roundtripEl.textContent = reconstructed.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC') +
      ' (seconds precision -- sub-second part is dropped by DATEADD(SECOND, ...))';
  }

  picker.addEventListener('input', recompute);
  if (nowBtn) nowBtn.addEventListener('click', setToNow);

  setToNow();
})();
