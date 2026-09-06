(function () {
  // Reads js/catalog.js's generic `types` array (tools, guides, and
  // whatever gets added later) instead of keeping its own per-type copies
  // -- that kind of duplication once caused a real bug (guides missing
  // from this palette entirely). Nothing below hardcodes "tools"/"guides"
  // by name; a new type in the catalog just shows up here automatically.
  var catalog = window.TOOLSHARP_CATALOG || { types: [] };

  // Exposed so other scripts (the home page terminal) can reuse the same
  // generic list instead of keeping their own copy of it.
  window.TOOLSHARP_TYPES = catalog.types;

  // Command Palette Logic
  //
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
    var allEntries = [];
    catalog.types.forEach(function (type) {
      type.items.forEach(function (item) {
        allEntries.push({ name: item.name, path: item.path, kind: type.kindLabel });
      });
    });
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

    // One primary link per registered type (tools/, guides/, and whatever
    // gets added later), in catalog order -- nothing here hardcodes "tools"
    // or "guides" by name.
    var dropdownContainer = document.createElement('div');
    dropdownContainer.className = 'nav-category-dropdowns';

    catalog.types.forEach(function (type) {
      var link = document.createElement('a');
      link.className = 'nav-dropdown-trigger nav-primary-link';
      link.href = pathPrefix + type.key;
      link.textContent = type.key + '/';
      dropdownContainer.appendChild(link);
    });

    // Separates the real destination pages (tools/, guides/) from the
    // category dropdowns after it, which are quick-jump shortcuts rather
    // than pages of their own -- without this they read as more items of
    // the same kind as "tools/", making it look redundant next to them.
    var navDivider = document.createElement('span');
    navDivider.className = 'nav-divider';
    navDivider.setAttribute('aria-hidden', 'true');
    dropdownContainer.appendChild(navDivider);

    // Category dropdowns only for types that opt in via
    // showCategoriesInNav (currently just tools -- guides' list is short
    // enough for its plain link above to be enough). Grouped from
    // js/catalog.js -- both which categories exist/their order and which
    // item has which category -- instead of keeping a second
    // hand-maintained copy of either. That duplication had already
    // drifted for real once: this dropdown used to show JWT Decoder under
    // "encoding" while tools/index.html has always grouped it under
    // "dev-helpers".
    var navCategoryGroups = [];
    catalog.types.forEach(function (type) {
      if (!type.showCategoriesInNav) return;
      type.categories.forEach(function (catName) {
        navCategoryGroups.push({
          name: catName,
          items: type.items
            .filter(function (it) { return it.category === catName; })
            .map(function (it) { return { name: it.name, path: it.path.replace(/^\//, '') }; })
        });
      });
    });

    navCategoryGroups.forEach(function(cat) {
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
    // category chip onto its own line. Reuses the same catalog.types /
    // navCategoryGroups data as the desktop dropdowns; <details>/<summary>
    // gives free accordion behavior with no extra JS.
    var mobileMenuToggle = document.createElement('button');
    mobileMenuToggle.type = 'button';
    mobileMenuToggle.className = 'mobile-menu-toggle';
    mobileMenuToggle.textContent = '☰';
    mobileMenuToggle.setAttribute('aria-label', 'Open menu');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');

    var mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';

    catalog.types.forEach(function (type) {
      var link = document.createElement('a');
      link.className = 'mobile-menu-link';
      link.href = pathPrefix + type.key;
      link.textContent = type.key + '/';
      mobileMenu.appendChild(link);
    });

    navCategoryGroups.forEach(function(cat) {
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
  });
})();
