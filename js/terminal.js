// Interactive prompt on the home page. Deliberately additive: everything it
// can reach is also present as a normal link elsewhere on the page or in the
// nav, so nothing here is required to navigate the site (and crawlers, screen
// readers, and no-JS visitors lose nothing by ignoring it).
(function () {
  var tools = window.TOOLSHARP_TOOLS || [];
  var guides = window.TOOLSHARP_GUIDES || [];

  // Keeps the home page's "N items" counts honest without hand-editing them
  // every time a tool or guide is added -- same data source the terminal
  // below and the command palette (theme.js) already use.
  var toolsCountEl = document.getElementById('toolsCount');
  if (toolsCountEl) toolsCountEl.textContent = tools.length + ' items';
  var guidesCountEl = document.getElementById('guidesCount');
  if (guidesCountEl) guidesCountEl.textContent = guides.length + ' items';

  var form = document.getElementById('termForm');
  if (!form) return;

  var input = document.getElementById('termInput');
  var out = document.getElementById('termOutput');

  var history = [];
  var historyIndex = -1;

  function slugOf(path) {
    return path.split('/').pop();
  }

  // Text only -- never used for anything the user typed unescaped.
  function line(text, cls) {
    var el = document.createElement('div');
    el.className = 'term-line' + (cls ? ' ' + cls : '');
    el.textContent = text;
    out.appendChild(el);
  }

  // Builds a row of links from our own data. The label is set with
  // textContent, so nothing user-supplied is ever parsed as HTML.
  function linkLine(items, prefix) {
    var el = document.createElement('div');
    el.className = 'term-line';
    items.forEach(function (item, i) {
      if (i) el.appendChild(document.createTextNode('  '));
      var a = document.createElement('a');
      a.href = item.path;
      a.textContent = (prefix || '') + slugOf(item.path);
      a.title = item.name;
      el.appendChild(a);
    });
    out.appendChild(el);
  }

  function scrollOut() {
    out.scrollTop = out.scrollHeight;
  }

  function findEntry(query) {
    var q = query.toLowerCase().replace(/^\/+/, '');
    var all = tools.concat(guides);
    var exact = all.filter(function (e) { return slugOf(e.path) === q; })[0];
    if (exact) return exact;
    return all.filter(function (e) {
      return slugOf(e.path).indexOf(q) !== -1 || e.name.toLowerCase().indexOf(q) !== -1;
    })[0];
  }

  var COMMANDS = {
    help: function () {
      line('Available commands:');
      line('  ls                    list the top-level directories');
      line('  ls tools              list every tool');
      line('  ls guides             list every guide');
      line('  open <name>           open a tool or guide (e.g. open json-formatter)');
      line('  cd tools | guides     go to that directory page');
      line('  whoami                what this site is');
      line('  clear                 clear this output');
      line('Everything here is also reachable by clicking — this is just faster.');
    },

    ls: function (arg) {
      if (!arg) {
        line('tools/   ' + tools.length + ' items');
        line('guides/  ' + guides.length + ' items');
        line('Try "ls tools" or "ls guides".');
        return;
      }
      var target = arg.replace(/\/+$/, '').toLowerCase();
      if (target === 'tools') { linkLine(tools); return; }
      if (target === 'guides') { linkLine(guides); return; }
      line('ls: no such directory: ' + arg, 'err');
    },

    open: function (arg) {
      if (!arg) { line('open: what? try "open json-formatter"', 'err'); return; }
      var entry = findEntry(arg);
      if (!entry) { line('open: not found: ' + arg, 'err'); return; }
      line('opening ' + entry.name + '...');
      scrollOut();
      window.location.href = entry.path;
    },

    cd: function (arg) {
      var target = (arg || '').replace(/\/+$/, '').toLowerCase();
      if (target === 'tools' || target === 'guides') {
        window.location.href = '/' + target;
        return;
      }
      if (target === '' || target === '~' || target === '/') {
        window.location.href = '/';
        return;
      }
      line('cd: not a directory: ' + (arg || ''), 'err');
    },

    whoami: function () {
      line('toolsharp.dev — small, sharp tools every developer reaches for.');
      line('Everything runs in your browser. Nothing you type is ever sent anywhere.');
    },

    clear: function () {
      out.innerHTML = '';
    }
  };

  function run(raw) {
    var trimmed = raw.trim();
    if (!trimmed) return;

    line('> ' + trimmed, 'cmd');

    var space = trimmed.indexOf(' ');
    var name = (space === -1 ? trimmed : trimmed.slice(0, space)).toLowerCase();
    var arg = space === -1 ? '' : trimmed.slice(space + 1).trim();

    var fn = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
    if (fn) {
      fn(arg);
    } else {
      line(name + ': command not found. Type "help" for the list.', 'err');
    }
    scrollOut();
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value;
    if (value.trim()) {
      history.push(value.trim());
      historyIndex = history.length;
    }
    run(value);
    input.value = '';
  });

  // Up/down through previous commands, like a real shell.
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      historyIndex = Math.max(0, historyIndex - 1);
      input.value = history[historyIndex] || '';
    } else if (e.key === 'ArrowDown') {
      if (!history.length) return;
      e.preventDefault();
      historyIndex = Math.min(history.length, historyIndex + 1);
      input.value = history[historyIndex] || '';
    }
  });

  // Clicking anywhere in the terminal focuses the input, but not when the
  // click was on a link or a text selection.
  var termEl = form.closest('.term');
  if (termEl) {
    termEl.addEventListener('click', function (e) {
      if (e.target.closest('a')) return;
      if (window.getSelection && String(window.getSelection())) return;
      input.focus();
    });
  }
})();
