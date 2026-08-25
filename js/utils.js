// Shared across every tool page (loaded like theme.js) -- the one place
// clipboard-copy logic lives, instead of each tool reimplementing it.

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
  var text = 'value' in el ? el.value : el.textContent;
  if (!text) return;
  if (typeof el.select === 'function') el.select();
  copyToClipboard(text, btn);
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
