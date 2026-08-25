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
