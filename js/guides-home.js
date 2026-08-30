function filterGuides() {
  const q = document.getElementById('guideFilter').value.toLowerCase();
  document.querySelectorAll('.dir-listing .dir-row').forEach(row => {
    const path = row.querySelector('.path-link').textContent.toLowerCase();
    const desc = row.querySelector('.desc').textContent.toLowerCase();
    row.style.display = (!q || path.includes(q) || desc.includes(q)) ? 'grid' : 'none';
  });
}

document.getElementById('guideFilter').addEventListener('input', filterGuides);
