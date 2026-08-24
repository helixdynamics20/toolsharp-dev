const OUTPUT_IDS = {
  camel: 'camelOutput',
  pascal: 'pascalOutput',
  snake: 'snakeOutput',
  kebab: 'kebabOutput',
  constant: 'constantOutput',
  dot: 'dotOutput',
  title: 'titleOutput',
  sentence: 'sentenceOutput',
  lower: 'lowerOutput',
};

function splitWords(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')   // fooBar -> foo Bar
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // HTTPServer -> HTTP Server
    .replace(/[_\-.\s]+/g, ' ')                // snake_case / kebab-case / dot.case -> spaces
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w.toLowerCase());
}

function cap(w) {
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function convertCase() {
  const input = document.getElementById('caseInput').value;
  const words = input.trim() ? splitWords(input) : [];

  if (!words.length) {
    Object.values(OUTPUT_IDS).forEach(id => { document.getElementById(id).value = ''; });
    return;
  }

  document.getElementById(OUTPUT_IDS.camel).value = words.map((w, i) => (i === 0 ? w : cap(w))).join('');
  document.getElementById(OUTPUT_IDS.pascal).value = words.map(cap).join('');
  document.getElementById(OUTPUT_IDS.snake).value = words.join('_');
  document.getElementById(OUTPUT_IDS.kebab).value = words.join('-');
  document.getElementById(OUTPUT_IDS.constant).value = words.join('_').toUpperCase();
  document.getElementById(OUTPUT_IDS.dot).value = words.join('.');
  document.getElementById(OUTPUT_IDS.title).value = words.map(cap).join(' ');
  document.getElementById(OUTPUT_IDS.sentence).value = cap(words[0]) + (words.length > 1 ? ' ' + words.slice(1).join(' ') : '');
  document.getElementById(OUTPUT_IDS.lower).value = words.join(' ');
}

function copyValue(id, btn) {
  const input = document.getElementById(id);
  if (!input || !input.value) return;
  input.select();
  navigator.clipboard.writeText(input.value);
  flashCopied(btn);
}

function clearCaseInput() {
  document.getElementById('caseInput').value = '';
  convertCase();
}

function tryCaseExample() {
  document.getElementById('caseInput').value = 'getHTTPResponseCode';
  convertCase();
}
