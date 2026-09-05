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

  // Command Palette Logic
  //
  // toolsList/guidesList used to be hand-maintained copies of the same data
  // that lives in tools/index.html, guides/index.html, and llms.txt -- that
  // duplication once caused a real bug (guides missing from this palette
  // entirely). They're now derived from the single catalog in
  // data/catalog.js (loaded before this script) instead of kept separately.
  var catalog = window.TOOLSHARP_CATALOG || { tools: [], guides: [], toolCategories: [], guideCategories: [] };
  var toolsList = catalog.tools.map(function (t) { return { name: t.name, path: t.path }; });
  var guidesList = catalog.guides.map(function (g) { return { name: g.name, path: g.path }; });

  // Exposed so other scripts (the home page terminal) can reuse this index
  // instead of keeping their own copy of it.
  window.TOOLSHARP_TOOLS = toolsList;
  window.TOOLSHARP_GUIDES = guidesList;

  // Every entry's path is already root-absolute ('/tools/json-formatter'), so it
  // can be assigned as-is from any page. A previous version tried to "adjust"
  // it relative to the current URL and stripped the leading slash, which made
  // the browser resolve it against the current directory -- selecting a tool
  // from any /guides/* page landed on /guides/tools/<slug> and 404'd.
  function navigateToEntry(entry) {
    if (entry && entry.path) window.location.href = entry.path;
  }

  var paletteActive = false;
  var paletteIndex = 0;
  var filteredTools = [];
  var paletteOpener = null;

  function createPalette() {
    paletteOpener = document.activeElement;

    var backdrop = document.createElement('div');
    backdrop.className = 'cmd-palette-backdrop';
    backdrop.id = 'cmdPalette';

    var palette = document.createElement('div');
    palette.className = 'cmd-palette';
    palette.setAttribute('role', 'dialog');
    palette.setAttribute('aria-modal', 'true');
    palette.setAttribute('aria-label', 'Search tools and guides');

    var searchContainer = document.createElement('div');
    searchContainer.className = 'cmd-palette-search';

    var prompt = document.createElement('span');
    prompt.className = 'cmd-palette-prompt';
    prompt.textContent = '>';

    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Search tools and guides... (Esc to close)';
    input.className = 'cmd-palette-input';
    input.autocomplete = 'off';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-controls', 'cmdPaletteList');

    searchContainer.appendChild(prompt);
    searchContainer.appendChild(input);
    palette.appendChild(searchContainer);

    var list = document.createElement('div');
    list.className = 'cmd-palette-list';
    list.id = 'cmdPaletteList';
    list.setAttribute('role', 'listbox');
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
      if (e.key === 'Tab') {
        // the palette's only real tab-stop is this input (list items are
        // navigated with arrow keys, like a combobox) -- keep focus here
        // instead of letting it escape to the page underneath
        e.preventDefault();
      } else if (e.key === 'Escape') {
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
          navigateToEntry(filteredTools[paletteIndex]);
        }
      }
    });

    renderList('');
  }

  function renderList(query) {
    var q = query.toLowerCase();
    var allEntries = toolsList.map(function(t) {
      return { name: t.name, path: t.path, kind: 'tool' };
    }).concat(guidesList.map(function(g) {
      return { name: g.name, path: g.path, kind: 'guide' };
    }));
    filteredTools = allEntries.filter(function(t) {
      return t.name.toLowerCase().indexOf(q) !== -1;
    });
    paletteIndex = 0;

    var list = document.querySelector('.cmd-palette-list');
    if (!list) return;
    list.innerHTML = '';

    filteredTools.forEach(function(entry, i) {
      var item = document.createElement('div');
      item.className = 'cmd-palette-item' + (i === 0 ? ' active' : '');
      item.id = 'cmd-item-' + i;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      var nameEl = document.createElement('span');
      nameEl.textContent = entry.name;
      var kindEl = document.createElement('span');
      kindEl.className = 'shortcut';
      kindEl.textContent = entry.kind;
      item.appendChild(nameEl);
      item.appendChild(kindEl);
      item.addEventListener('click', function() {
        navigateToEntry(entry);
      });
      list.appendChild(item);
    });

    var inputEl = document.querySelector('.cmd-palette-input');
    if (inputEl) inputEl.setAttribute('aria-activedescendant', filteredTools.length ? 'cmd-item-0' : '');
  }

  function updateActiveItem() {
    var items = document.querySelectorAll('.cmd-palette-item');
    items.forEach(function(item, i) {
      if (i === paletteIndex) {
        item.classList.add('active');
        item.setAttribute('aria-selected', 'true');
        item.scrollIntoView({ block: 'nearest' });
      } else {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      }
    });
    var inputEl = document.querySelector('.cmd-palette-input');
    if (inputEl && items[paletteIndex]) inputEl.setAttribute('aria-activedescendant', items[paletteIndex].id);
  }

  function closePalette() {
    var palette = document.getElementById('cmdPalette');
    if (palette) palette.remove();
    if (paletteOpener && typeof paletteOpener.focus === 'function') paletteOpener.focus();
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

  // Dynamic Header Categorized Navigation Menu
  window.addEventListener('DOMContentLoaded', function() {
    var navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;

    var isToolSubpage = window.location.pathname.includes('/tools/');
    var isGuideSubpage = window.location.pathname.includes('/guides/');
    var pathPrefix = (isToolSubpage || isGuideSubpage) ? '../' : '';

    // Grouped from js/catalog.js -- both which categories exist/their
    // order (catalog.toolCategories) and which tool has which category --
    // instead of keeping a second hand-maintained copy of either. That
    // duplication had already drifted for real: this dropdown used to show
    // JWT Decoder under "encoding" while tools/index.html has always
    // grouped it under "dev-helpers".
    var categories = catalog.toolCategories.map(function (catName) {
      return {
        name: catName,
        items: catalog.tools
          .filter(function (t) { return t.category === catName; })
          .map(function (t) { return { name: t.name, path: t.path.replace(/^\//, '') }; })
      };
    });

    var dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'nav-category-dropdowns';

    var toolsLink = document.createElement('a');
    toolsLink.className = 'nav-dropdown-trigger nav-primary-link';
    toolsLink.href = pathPrefix + 'tools';
    toolsLink.textContent = 'tools/';
    dropdownContainer.appendChild(toolsLink);

    var guidesLink = document.createElement('a');
    guidesLink.className = 'nav-dropdown-trigger nav-primary-link';
    guidesLink.href = pathPrefix + 'guides';
    guidesLink.textContent = 'guides/';
    dropdownContainer.appendChild(guidesLink);

    // Separates the two real destination pages (tools/, guides/) from the
    // category dropdowns after it, which are quick-jump shortcuts into
    // tools/ rather than pages of their own -- without this they read as
    // five more items of the same kind as "tools/", making it look
    // redundant next to them.
    var navDivider = document.createElement('span');
    navDivider.className = 'nav-divider';
    navDivider.setAttribute('aria-hidden', 'true');
    dropdownContainer.appendChild(navDivider);

    categories.forEach(function(cat) {
      var dropdown = document.createElement('div');
      dropdown.className = 'nav-dropdown';

      var trigger = document.createElement('div');
      trigger.className = 'nav-dropdown-trigger';
      trigger.textContent = cat.name + '/';
      trigger.tabIndex = 0;
      trigger.setAttribute('role', 'button');
      trigger.setAttribute('aria-haspopup', 'true');
      trigger.setAttribute('aria-expanded', 'false');

      var menu = document.createElement('div');
      menu.className = 'nav-dropdown-menu';

      cat.items.forEach(function(item) {
        var a = document.createElement('a');
        a.className = 'nav-dropdown-item';
        a.href = pathPrefix + item.path;
        a.textContent = item.name;
        menu.appendChild(a);
      });

      dropdown.appendChild(trigger);
      dropdown.appendChild(menu);
      dropdownContainer.appendChild(dropdown);

      trigger.addEventListener('click', function(e) {
        e.stopPropagation();
        var isActive = dropdown.classList.contains('active');
        closeAllDropdowns();
        if (!isActive) { dropdown.classList.add('active'); trigger.setAttribute('aria-expanded', 'true'); }
      });

      trigger.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          trigger.click();
        } else if (e.key === 'Escape') {
          closeAllDropdowns();
        }
      });
    });

    function closeAllDropdowns() {
      document.querySelectorAll('.nav-dropdown').forEach(function(d) {
        d.classList.remove('active');
        var t = d.querySelector('.nav-dropdown-trigger');
        if (t) t.setAttribute('aria-expanded', 'false');
      });
    }

    document.addEventListener('click', closeAllDropdowns);

    // Mobile menu: a single toggle button instead of wrapping every
    // category chip onto its own line. Reuses the same categories/guidesLink
    // data as the desktop dropdowns; <details>/<summary> gives free
    // accordion behavior with no extra JS.
    var mobileMenuToggle = document.createElement('button');
    mobileMenuToggle.type = 'button';
    mobileMenuToggle.className = 'mobile-menu-toggle';
    mobileMenuToggle.textContent = '☰';
    mobileMenuToggle.setAttribute('aria-label', 'Open menu');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');

    var mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';

    var mobileToolsLink = document.createElement('a');
    mobileToolsLink.className = 'mobile-menu-link';
    mobileToolsLink.href = pathPrefix + 'tools';
    mobileToolsLink.textContent = 'tools/';
    mobileMenu.appendChild(mobileToolsLink);

    var mobileGuidesLink = document.createElement('a');
    mobileGuidesLink.className = 'mobile-menu-link';
    mobileGuidesLink.href = pathPrefix + 'guides';
    mobileGuidesLink.textContent = 'guides/';
    mobileMenu.appendChild(mobileGuidesLink);

    categories.forEach(function(cat) {
      var details = document.createElement('details');
      var summary = document.createElement('summary');
      summary.textContent = cat.name + '/';
      details.appendChild(summary);

      cat.items.forEach(function(item) {
        var a = document.createElement('a');
        a.href = pathPrefix + item.path;
        a.textContent = item.name;
        details.appendChild(a);
      });

      mobileMenu.appendChild(details);
    });

    function closeMobileMenu() {
      mobileMenu.classList.remove('active');
      mobileMenuToggle.setAttribute('aria-expanded', 'false');
      mobileMenuToggle.setAttribute('aria-label', 'Open menu');
      mobileMenuToggle.textContent = '☰';
    }

    mobileMenuToggle.addEventListener('click', function(e) {
      e.stopPropagation();
      var isActive = mobileMenu.classList.contains('active');
      if (isActive) {
        closeMobileMenu();
      } else {
        mobileMenu.classList.add('active');
        mobileMenuToggle.setAttribute('aria-expanded', 'true');
        mobileMenuToggle.setAttribute('aria-label', 'Close menu');
        mobileMenuToggle.textContent = '✕';
      }
    });
    mobileMenu.addEventListener('click', function(e) { e.stopPropagation(); });
    document.addEventListener('click', closeMobileMenu);
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') closeMobileMenu();
    });

    var toggleBtn = document.getElementById('darkModeToggle');
    if (toggleBtn) {
      var existingAllTools = Array.from(navLinks.querySelectorAll('a')).find(function(el) {
        return el.textContent.includes('← all tools') || el.textContent.includes('← tools');
      });

      navLinks.innerHTML = '';
      if (isToolSubpage && existingAllTools) {
        existingAllTools.textContent = '← tools';
        navLinks.appendChild(existingAllTools);
      }

      navLinks.appendChild(dropdownContainer);
      navLinks.appendChild(toggleBtn);
      navLinks.appendChild(mobileMenuToggle);
      var header = document.querySelector('.site-header');
      if (header) header.appendChild(mobileMenu);
    }

    // Inject Vercel Web Analytics & Speed Insights
    try {
      var vaScript = document.createElement('script');
      vaScript.defer = true;
      vaScript.src = '/_vercel/insights/script.js';
      document.head.appendChild(vaScript);

      var siScript = document.createElement('script');
      siScript.defer = true;
      siScript.src = '/_vercel/speed-insights/script.js';
      document.head.appendChild(siScript);
    } catch (e) {
      console.warn('Vercel scripts failed to load:', e);
    }
  });

})();
