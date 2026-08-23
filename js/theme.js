const sunIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="theme-icon" style="vertical-align: middle; display: inline-block; margin-top: -2px;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;

const moonIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="theme-icon" style="vertical-align: middle; display: inline-block; margin-top: -2px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;

function applyTheme() {
  const theme = localStorage.getItem('toolsharp_theme');
  const toggleEl = document.getElementById('darkModeToggle');
  if (theme === 'dark') {
    document.body.classList.add('dark-theme');
    if (toggleEl) toggleEl.innerHTML = sunIcon;
  } else {
    document.body.classList.remove('dark-theme');
    if (toggleEl) toggleEl.innerHTML = moonIcon;
  }
}

function toggleDarkMode() {
  const current = localStorage.getItem('toolsharp_theme');
  if (current === 'dark') {
    localStorage.setItem('toolsharp_theme', 'light');
  } else {
    localStorage.setItem('toolsharp_theme', 'dark');
  }
  applyTheme();
}

// Prevent theme flash on loading
(function() {
  const theme = localStorage.getItem('toolsharp_theme');
  if (theme === 'dark') {
    document.documentElement.classList.add('dark-theme');
  }
})();

window.addEventListener('DOMContentLoaded', () => {
  if (document.documentElement.classList.contains('dark-theme')) {
    document.body.classList.add('dark-theme');
    document.documentElement.classList.remove('dark-theme');
  }
  applyTheme();
});
