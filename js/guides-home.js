function filterGuides() {
  const q = document.getElementById('guideFilter').value.toLowerCase();
  document.querySelectorAll('.dir-listing .dir-row').forEach(row => {
    const path = row.querySelector('.path-link').textContent.toLowerCase();
    const desc = row.querySelector('.desc').textContent.toLowerCase();
    row.style.display = (!q || path.includes(q) || desc.includes(q)) ? 'grid' : 'none';
  });
  // Hide category headers with no visible guides under them
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

document.getElementById('guideFilter').addEventListener('input', filterGuides);
