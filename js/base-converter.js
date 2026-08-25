// Number base conversion — Binary, Octal, Decimal, Hexadecimal, all via BigInt
// so large 64-bit-range values (e.g. a C# long) convert correctly without
// precision loss (Number.MAX_SAFE_INTEGER is only 2^53 - 1).

const BASE_VALID_RE = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^[0-9]+$/,
  16: /^[0-9a-fA-F]+$/,
};

const BASE_LABEL = { 2: 'binary', 8: 'octal', 10: 'decimal', 16: 'hexadecimal' };

// Parses `raw` as a signed integer. `selectedBase` is used only when no
// 0x/0b/0o prefix is present; a recognized prefix always wins so pasted
// values like "0xFF" are never misread using the currently selected base.
function parseBigIntWithBase(raw, selectedBase) {
  let s = raw.trim();
  if (s === '') return null;

  let neg = false;
  if (s[0] === '+' || s[0] === '-') {
    neg = s[0] === '-';
    s = s.slice(1);
  }
  if (s === '') throw new Error('No digits after sign.');

  let digitsStr = s;
  let effectiveBase = selectedBase;
  if (/^0[xX]/.test(s)) { digitsStr = s.slice(2); effectiveBase = 16; }
  else if (/^0[bB]/.test(s)) { digitsStr = s.slice(2); effectiveBase = 2; }
  else if (/^0[oO]/.test(s)) { digitsStr = s.slice(2); effectiveBase = 8; }

  if (digitsStr === '') throw new Error('No digits found after base prefix.');

  if (!BASE_VALID_RE[effectiveBase].test(digitsStr)) {
    throw new Error(`"${raw.trim()}" is not a valid ${BASE_LABEL[effectiveBase]} number.`);
  }

  let value = 0n;
  const bigBase = BigInt(effectiveBase);
  for (const ch of digitsStr) {
    value = value * bigBase + BigInt(parseInt(ch, 16));
  }
  return neg ? -value : value;
}

function formatAll(value) {
  const neg = value < 0n;
  const abs = neg ? -value : value;
  const sign = neg ? '-' : '';
  return {
    bin: sign + abs.toString(2),
    oct: sign + abs.toString(8),
    dec: value.toString(10),
    hex: sign + abs.toString(16),
  };
}

// Groups a binary digit string into nibbles from the right: "11111111" -> "1111 1111"
function groupBinary(bin) {
  const sign = bin.startsWith('-') ? '-' : '';
  const clean = bin.replace(/^-/, '');
  const groups = [];
  for (let i = clean.length; i > 0; i -= 4) {
    groups.unshift(clean.slice(Math.max(0, i - 4), i));
  }
  return sign + groups.join(' ');
}

function getSelectedBase() {
  const checked = document.querySelector('input[name="inputBase"]:checked');
  return checked ? parseInt(checked.value, 10) : 10;
}

function showError(msg) {
  const el = document.getElementById('baseError');
  if (!msg) {
    el.style.display = 'none';
    el.textContent = '';
    return;
  }
  el.style.display = 'block';
  el.textContent = msg;
}

function clearOutputs() {
  document.getElementById('binOutput').value = '';
  document.getElementById('octOutput').value = '';
  document.getElementById('decOutput').value = '';
  document.getElementById('hexOutput').value = '';
}

function convertBase() {
  const raw = document.getElementById('baseInput').value;
  const base = getSelectedBase();

  if (!raw.trim()) {
    clearOutputs();
    showError('');
    return;
  }

  try {
    const value = parseBigIntWithBase(raw, base);
    if (value === null) {
      clearOutputs();
      showError('');
      return;
    }
    const f = formatAll(value);
    document.getElementById('binOutput').value = groupBinary(f.bin);
    document.getElementById('octOutput').value = f.oct;
    document.getElementById('decOutput').value = f.dec;
    document.getElementById('hexOutput').value = (f.hex.startsWith('-') ? '-0x' + f.hex.slice(1) : '0x' + f.hex);
    showError('');
  } catch (e) {
    clearOutputs();
    showError(e.message || 'Invalid number for the selected base.');
  }
}

function tryBaseExample() {
  // classic memorable value: 0xDEADBEEF = 3735928559
  document.querySelector('input[name="inputBase"][value="16"]').checked = true;
  document.getElementById('baseInput').value = 'DEADBEEF';
  convertBase();
}

function clearBaseInput() {
  document.getElementById('baseInput').value = '';
  showError('');
  clearOutputs();
}
