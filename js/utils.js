// Shared across every tool page (loaded like theme.js) -- the one place
// clipboard-copy logic lives, instead of each tool reimplementing it.

// Delegated so a single listener (loaded once, here) covers every
// data-copy/data-download button on every tool page, instead of each
// button needing its own onclick attribute (which a strict script-src
// CSP can't allow -- inline handlers count as inline script).
document.addEventListener('click', function (e) {
  var copyBtn = e.target.closest('[data-copy]');
  if (copyBtn) { copyElementValue(copyBtn.getAttribute('data-copy'), copyBtn); return; }
  var dlBtn = e.target.closest('[data-download]');
  if (dlBtn) { downloadElementValue(dlBtn.getAttribute('data-download'), dlBtn.getAttribute('data-filename')); return; }
  // Homepage/guides-index "click anywhere in the row" rows -- skip when the
  // click already landed on the row's own link, which navigates on its own.
  var row = e.target.closest('[data-row-href]');
  if (row && !e.target.closest('a')) { window.location.href = row.getAttribute('data-row-href'); }
});

function copyToClipboard(text, btn) {
  if (!text) return;
  navigator.clipboard.writeText(text).then(function () {
    if (typeof flashCopied === 'function') flashCopied(btn);
  });
}

// covers both form fields (.value) and plain text containers
// (.textContent, e.g. a <pre> or <div>) with one function
function copyElementValue(id, btn) {
  var el = document.getElementById(id);
  if (!el) return;
  // data-copy-value wins when present -- for an element built from nested
  // children (share-pad's grouped-digit display, for one), .textContent
  // picks up the source markup's own whitespace/indentation between them,
  // not just the digits.
  var text = el.dataset.copyValue !== undefined ? el.dataset.copyValue
    : ('value' in el ? el.value : el.textContent);
  if (!text) return;
  if (typeof el.select === 'function') el.select();
  copyToClipboard(text, btn);
}

// Saves arbitrary text as a downloaded file -- for tools whose output is
// realistically too large to want to paste back out of a text field.
function downloadTextAsFile(filename, text) {
  if (!text) return;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Same as above but reads from a form field's .value or a plain element's
// .textContent, mirroring copyElementValue's dual-purpose lookup.
function downloadElementValue(id, filename) {
  var el = document.getElementById(id);
  if (!el) return;
  var text = 'value' in el ? el.value : el.textContent;
  downloadTextAsFile(filename, text);
}

// Persist a set of form-field values per tool (localStorage), so a
// user's preferred options survive a reload/return visit. Call once on
// init -- before the tool's own initial render -- with the tool's
// storage key and the ids of every field to remember.
function persistFormState(toolKey, fieldIds) {
  var STORAGE_KEY = 'toolsharp-settings-' + toolKey;
  var state;
  try { state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (e) { state = {}; }

  fieldIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el || !(id in state)) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = state[id];
    else el.value = state[id];
  });

  function save() {
    var next = {};
    fieldIds.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      next[id] = (el.type === 'checkbox' || el.type === 'radio') ? el.checked : el.value;
    });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch (e) {}
  }

  fieldIds.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', save);
    el.addEventListener('input', save);
  });
}
