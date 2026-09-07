(function () {
  var STORAGE_KEY = 'toolsharp-dark-theme';
  var sunIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="theme-icon" style="vertical-align: middle; display: inline-block; margin-top: -2px;"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
  var moonIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="theme-icon" style="vertical-align: middle; display: inline-block; margin-top: -2px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';

  function isDarkPreferred() {
    try {
      var stored = localStorage.getItem(STORAGE_KEY);
      if (stored !== null) return stored === 'true';
    } catch (e) {}
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function updateToggleIcon(isDark) {
    var toggle = document.getElementById('darkModeToggle');
    if (!toggle) return;
    toggle.innerHTML = isDark ? sunIcon : moonIcon;
    var label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('title', label);
  }

  if (isDarkPreferred()) {
    document.body.classList.add('dark-theme');
  }
  updateToggleIcon(document.body.classList.contains('dark-theme'));

  window.toggleDarkMode = function () {
    var isDark = document.body.classList.toggle('dark-theme');
    updateToggleIcon(isDark);
    try { localStorage.setItem(STORAGE_KEY, String(isDark)); } catch (e) {}
  };

  (function () {
    var toggle = document.getElementById('darkModeToggle');
    if (toggle) {
      toggle.addEventListener('click', function (e) {
        e.preventDefault();
        window.toggleDarkMode();
      });
    }
  })();

  window.flashCopied = function (btn) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () { btn.textContent = orig; }, 1200);
  };

  // Recently Used Tools (client-side only, read by index.html)
  var RECENT_KEY = 'toolsharp-recent-tools';
  var RECENT_MAX = 6;

  (function recordRecentTool() {
    var m = window.location.pathname.match(/\/tools\/([^\/]+)$/);
    if (!m) return;
    var file = m[1];
    try {
      var recent = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      recent = recent.filter(function (f) { return f !== file; });
      recent.unshift(file);
      localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, RECENT_MAX)));
    } catch (e) {}
  })();

  window.getRecentToolFiles = function () {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch (e) { return []; }
  };

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/service-worker.js').then(function(registration) {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      }, function(err) {
        console.log('ServiceWorker registration failed: ', err);
      });
    });
  }

})();

// Command palette (Ctrl/Cmd+K) and the dynamic header nav dropdowns/mobile
// menu used to live in this file too. Split into js/nav.js -- dark/light
// mode and site-wide bootstrap (this file) is a different concern from
// "search and browse the catalog" (nav.js), and the two never share state,
// just a load order (nav.js needs catalog.js, same as this file does).
