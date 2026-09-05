// Interactive prompt on the home page. Deliberately additive: everything it
// can reach is also present as a normal link elsewhere on the page or in the
// nav, so nothing here is required to navigate the site (and crawlers, screen
// readers, and no-JS visitors lose nothing by ignoring it).
(function () {
  // window.TOOLSHARP_TYPES (set by theme.js from js/catalog.js) is a
  // generic list of content types -- tools, guides, and whatever gets
  // added later. Nothing below hardcodes "tools"/"guides" by name; a new
  // type just needs a matching #<key>Count element (optional) and shows up
  // in ls/cd/open automatically.
  var types = window.TOOLSHARP_TYPES || [];

  function typeByKey(key) {
    for (var i = 0; i < types.length; i++) if (types[i].key === key) return types[i];
    return null;
  }

  // Keeps the home page's "N items" counts honest without hand-editing them
  // every time a tool or guide is added -- same data source the terminal
  // below and the command palette (theme.js) already use. Only touches an
  // element if the home page actually has one for that type.
  types.forEach(function (type) {
    var countEl = document.getElementById(type.key + 'Count');
    if (countEl) countEl.textContent = type.items.length + ' items';
  });

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
    var all = [];
    types.forEach(function (type) { all = all.concat(type.items); });
    var exact = all.filter(function (e) { return slugOf(e.path) === q; })[0];
    if (exact) return exact;
    return all.filter(function (e) {
      return slugOf(e.path).indexOf(q) !== -1 || e.name.toLowerCase().indexOf(q) !== -1;
    })[0];
  }

  // Right-pads to a fixed column so the generated help/ls lines line up
  // the way the old hand-written ones did, regardless of how many types
  // are registered or how long their keys are.
  function padTo(s, width) {
    return s.length >= width ? s + ' ' : s + new Array(width - s.length + 1).join(' ');
  }

  var COMMANDS = {
    help: function () {
      line('Available commands:');
      line('  ls' + padTo('', 21) + 'list the top-level directories');
      types.forEach(function (type) {
        line('  ls ' + padTo(type.key, 20) + 'list every ' + type.kindLabel);
      });
      var kindList = types.map(function (t) { return t.kindLabel; }).join(' or ');
      line('  open <name>' + padTo('', 11) + 'open a ' + kindList + ' (e.g. open json-formatter)');
      var keyList = types.map(function (t) { return t.key; }).join(' | ');
      line('  cd ' + padTo(keyList, 19) + 'go to that directory page');
      line('  whoami' + padTo('', 16) + 'what this site is');
      line('  clear' + padTo('', 17) + 'clear this output');
      line('Everything here is also reachable by clicking — this is just faster.');
    },

    ls: function (arg) {
      if (!arg) {
        types.forEach(function (type) {
          line(padTo(type.key + '/', 9) + type.items.length + ' items');
        });
        line('Try "ls ' + types.map(function (t) { return t.key; }).join('" or "ls ') + '".');
        return;
      }
      var target = arg.replace(/\/+$/, '').toLowerCase();
      var type = typeByKey(target);
      if (type) { linkLine(type.items); return; }
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
      if (typeByKey(target)) {
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
      line('Built by a backend engineer tired of losing five minutes to connection string syntax and cron field order.');
      line('Type "ls" or "help" to look around.');
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
