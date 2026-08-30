window.addEventListener('DOMContentLoaded', function () {
  if (typeof getRecentToolFiles !== 'function') return;
  var recentFiles = getRecentToolFiles();
  if (!recentFiles.length) return;

  var listing = document.getElementById('tools');
  var head = listing.querySelector('.dir-row-head');
  var allRows = Array.prototype.slice.call(listing.querySelectorAll('.dir-row'));

  var matched = recentFiles.map(function (file) {
    return allRows.filter(function (row) {
      var link = row.querySelector('.path-link');
      return link && link.getAttribute('href') === 'tools/' + file;
    })[0];
  }).filter(Boolean);
  if (!matched.length) return;

  var cat = document.createElement('div');
  cat.className = 'dir-category';
  cat.id = 'cat-recent';
  cat.textContent = 'recent/';

  var insertionPoint = cat;
  head.parentNode.insertBefore(cat, head.nextSibling);
  matched.forEach(function (row) {
    var clone = row.cloneNode(true);
    insertionPoint.parentNode.insertBefore(clone, insertionPoint.nextSibling);
    insertionPoint = clone;
  });
});

function filterTools() {
  const q = document.getElementById('toolFilter').value.toLowerCase();
  const rows = document.querySelectorAll('.dir-listing .dir-row');
  rows.forEach(row => {
    const path = row.querySelector('.path-link').textContent.toLowerCase();
    const desc = row.querySelector('.desc').textContent.toLowerCase();
    row.style.display = (!q || path.includes(q) || desc.includes(q)) ? 'grid' : 'none';
  });
  // Hide category headers with no visible tools under them
  document.querySelectorAll('.dir-category').forEach(cat => {
    let sib = cat.nextElementSibling;
    let anyVisible = false;
    while (sib && !sib.classList.contains('dir-category')) {
      if (sib.style.display !== 'none') anyVisible = true;
      sib = sib.nextElementSibling;
    }
    cat.style.display = anyVisible ? '' : 'none';
  });
}

document.getElementById('toolFilter').addEventListener('input', filterTools);
