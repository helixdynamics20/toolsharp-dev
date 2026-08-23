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
    if (toggle) toggle.innerHTML = isDark ? sunIcon : moonIcon;
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

  window.flashCopied = function (btn) {
    if (!btn) return;
    var orig = btn.textContent;
    btn.textContent = 'Copied!';
    setTimeout(function () { btn.textContent = orig; }, 1200);
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

  // Command Palette Logic
  var toolsList = [
    { name: 'Connection String Builder', path: '/tools/connection-string-builder.html' },
    { name: 'Cron Builder & Explainer', path: '/tools/cron-builder.html' },
    { name: 'JWT Decoder', path: '/tools/jwt-decoder.html' },
    { name: 'GUID Formatter & Generator', path: '/tools/guid-formatter.html' },
    { name: 'Regex Tester', path: '/tools/regex-tester.html' },
    { name: 'AppSettings Validator', path: '/tools/appsettings-validator.html' },
    { name: 'JSON Formatter & Minifier', path: '/tools/json-formatter.html' },
    { name: 'Diff Checker', path: '/tools/diff-checker.html' },
    { name: 'Base64 Converter', path: '/tools/base64-converter.html' },
    { name: 'Share Pad', path: '/tools/share-pad.html' },
    { name: 'Cryptographic Hash Generator', path: '/tools/hash-generator.html' },
    { name: 'Epoch & Timestamp Converter', path: '/tools/epoch-converter.html' }
  ];

  var paletteActive = false;
  var paletteIndex = 0;
  var filteredTools = [];

  function createPalette() {
    var backdrop = document.createElement('div');
    backdrop.className = 'cmd-palette-backdrop';
    backdrop.id = 'cmdPalette';

    var palette = document.createElement('div');
    palette.className = 'cmd-palette';

    var searchContainer = document.createElement('div');
    searchContainer.className = 'cmd-palette-search';
    
    var prompt = document.createElement('span');
    prompt.className = 'cmd-palette-prompt';
    prompt.textContent = '>';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search tools... (Esc to close)';
    input.className = 'cmd-palette-input';
    input.autocomplete = 'off';

    searchContainer.appendChild(prompt);
    searchContainer.appendChild(input);
    palette.appendChild(searchContainer);

    var list = document.createElement('div');
    list.className = 'cmd-palette-list';
    palette.appendChild(list);

    var help = document.createElement('div');
    help.className = 'cmd-palette-help';
    help.innerHTML = '<span>↑↓ to navigate · Enter to select</span><span>ESC to close</span>';
    palette.appendChild(help);

    backdrop.appendChild(palette);
    document.body.appendChild(backdrop);

    input.focus();

    backdrop.addEventListener('click', function(e) {
      if (e.target === backdrop) closePalette();
    });

    input.addEventListener('input', function() {
      renderList(input.value);
    });

    input.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closePalette();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        paletteIndex = (paletteIndex + 1) % filteredTools.length;
        updateActiveItem();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        paletteIndex = (paletteIndex - 1 + filteredTools.length) % filteredTools.length;
        updateActiveItem();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredTools[paletteIndex]) {
          // Adjust path relative to current URL
          var currentPath = window.location.pathname;
          var targetPath = filteredTools[paletteIndex].path;
          if (currentPath.includes('/tools/')) {
            targetPath = '..' + targetPath;
          } else {
            targetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
          }
          window.location.href = targetPath;
        }
      }
    });

    renderList('');
  }

  function renderList(query) {
    filteredTools = toolsList.filter(function(t) {
      return t.name.toLowerCase().includes(query.toLowerCase());
    });
    paletteIndex = 0;
    
    var list = document.querySelector('.cmd-palette-list');
    if (!list) return;
    list.innerHTML = '';

    filteredTools.forEach(function(tool, i) {
      var item = document.createElement('div');
      item.className = 'cmd-palette-item' + (i === 0 ? ' active' : '');
      item.innerHTML = '<span>' + tool.name + '</span><span class="shortcut">jump to</span>';
      item.addEventListener('click', function() {
        var currentPath = window.location.pathname;
        var targetPath = tool.path;
        if (currentPath.includes('/tools/')) {
          targetPath = '..' + targetPath;
        } else {
          targetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
        }
        window.location.href = targetPath;
      });
      list.appendChild(item);
    });
  }

  function updateActiveItem() {
    var items = document.querySelectorAll('.cmd-palette-item');
    items.forEach(function(item, i) {
      if (i === paletteIndex) {
        item.classList.add('active');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
      }
    });
  }

  function closePalette() {
    var palette = document.getElementById('cmdPalette');
    if (palette) palette.remove();
    paletteActive = false;
  }

  window.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      if (paletteActive) {
        closePalette();
      } else {
        paletteActive = true;
        createPalette();
      }
    }
  });


})();
