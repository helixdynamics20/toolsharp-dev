// Live epoch readout for the Unix timestamp guide. Progressive enhancement:
// the markup ships with a static fallback, so with JS off the page still
// reads correctly -- it just doesn't tick.
(function () {
  var secEl = document.getElementById('epochNowS');
  if (!secEl) return;

  var msEl = document.getElementById('epochNowMs');
  var utcEl = document.getElementById('epochNowUtc');

  function tick() {
    var now = Date.now();
    secEl.textContent = String(Math.floor(now / 1000));
    if (msEl) msEl.textContent = String(now);
    if (utcEl) {
      utcEl.textContent = new Date(now).toISOString()
        .replace('T', ' ')
        .replace(/\.\d+Z$/, ' UTC');
    }
  }

  tick();
  setInterval(tick, 1000);
})();
