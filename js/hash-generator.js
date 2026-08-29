// MD5 implementation in JavaScript (since Web Crypto doesn't support MD5).
// md5Core operates on raw bytes and returns the raw 16-byte digest, so the
// same core can be reused for hashing text, hashing a file's bytes, and the
// hand-rolled HMAC-MD5 construction below (all three just feed it different
// byte arrays).
function md5Core(bytes) {
  var s = [
        7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,  7, 12, 17, 22,
        5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,  5,  9, 14, 20,
        4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,  4, 11, 16, 23,
        6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21,  6, 10, 15, 21
      ],
      t = [
        0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
        0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
        0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
        0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
        0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
        0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
        0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
        0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391
      ],
      h0 = 0x67452301,
      h1 = 0xefcdab89,
      h2 = 0x98badcfe,
      h3 = 0x10325476;

  var n = bytes.length,
      words = [];
  for (var i = 0; i < n; i++) {
    words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  }
  words[n >> 2] |= 0x80 << ((n % 4) * 8);
  var wordCount = ((n + 8) >> 6) * 16 + 14;
  while (words.length < wordCount) { words.push(0); }
  words[wordCount] = n * 8;
  words[wordCount + 1] = 0;

  for (var chunk = 0; chunk < words.length; chunk += 16) {
    var a = h0, b_val = h1, c = h2, d = h3;
    for (var j = 0; j < 64; j++) {
      var f, g;
      if (j < 16) {
        f = (b_val & c) | (~b_val & d);
        g = j;
      } else if (j < 32) {
        f = (d & b_val) | (~d & c);
        g = (5 * j + 1) % 16;
      } else if (j < 48) {
        f = b_val ^ c ^ d;
        g = (3 * j + 5) % 16;
      } else {
        f = c ^ (b_val | ~d);
        g = (7 * j) % 16;
      }
      var temp = d;
      d = c;
      c = b_val;
      b_val = (b_val + rotateLeft((a + f + t[j] + words[chunk + g]), s[j])) | 0;
      a = temp;
    }
    h0 = (h0 + a) | 0;
    h1 = (h1 + b_val) | 0;
    h2 = (h2 + c) | 0;
    h3 = (h3 + d) | 0;
  }

  function rotateLeft(l, r) { return (l << r) | (l >>> (32 - r)); }

  var out = new Uint8Array(16);
  [h0, h1, h2, h3].forEach(function (h, idx) {
    for (var k = 0; k < 4; k++) out[idx * 4 + k] = (h >> (k * 8)) & 255;
  });
  return out;
}

function hexFromBytes(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function md5(string) {
  return hexFromBytes(md5Core(encodeText(string)));
}

function md5Bytes(bytes) {
  return hexFromBytes(md5Core(bytes));
}

// Generic HMAC construction (RFC 2104) built on md5Core, since Web Crypto's
// HMAC support doesn't cover MD5. blockSize is 64 bytes for MD5, same as
// SHA-1/256 (SubtleCrypto handles HMAC for those algorithms directly instead).
function hmacMd5Bytes(keyBytes, msgBytes) {
  const blockSize = 64;
  let key = keyBytes;
  if (key.length > blockSize) key = md5Core(key);
  if (key.length < blockSize) {
    const padded = new Uint8Array(blockSize);
    padded.set(key);
    key = padded;
  }
  const oKeyPad = new Uint8Array(blockSize);
  const iKeyPad = new Uint8Array(blockSize);
  for (let i = 0; i < blockSize; i++) {
    oKeyPad[i] = key[i] ^ 0x5c;
    iKeyPad[i] = key[i] ^ 0x36;
  }
  const inner = md5Core(concatBytes(iKeyPad, msgBytes));
  const outer = md5Core(concatBytes(oKeyPad, inner));
  return hexFromBytes(outer);
}

function concatBytes(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// Helper to encode string to Uint8Array
function encodeText(text) {
  return new TextEncoder().encode(text);
}

// Web Crypto Hash Helper -- msgBytes is a Uint8Array (text or file bytes)
async function cryptoHash(algo, msgBytes) {
  const hashBuffer = await crypto.subtle.digest(algo, msgBytes);
  return hexFromBytes(new Uint8Array(hashBuffer));
}

// Web Crypto HMAC Helper, for the algorithms SubtleCrypto supports directly
async function cryptoHmac(algo, keyBytes, msgBytes) {
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: algo }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, msgBytes);
  return hexFromBytes(new Uint8Array(sig));
}

// Each digest is async -- without a guard, an older (slower) call's writes
// could land after a newer call's, showing a hash that no longer matches
// the input.
let hashGenToken = 0;
let _hashInputTimer = null;

// md5() below is a synchronous hand-rolled implementation (the others go
// through async crypto.subtle), so debounce plain typing to avoid running
// it on every keystroke for a large pasted document.
function scheduleGenerateHashes() {
  clearTimeout(_hashInputTimer);
  _hashInputTimer = setTimeout(generateHashes, 200);
}

// Set when a file is selected via loadHashFile(); hashing switches from the
// textarea to these bytes until the file selection is cleared.
let selectedFileBytes = null;

async function generateHashes() {
  const keyText = document.getElementById('hashHmacKey').value;
  const hasKey = keyText.length > 0;
  const token = ++hashGenToken;

  let msgBytes;
  if (selectedFileBytes) {
    msgBytes = selectedFileBytes;
  } else {
    const input = document.getElementById('hashInput').value;
    if (!input) {
      document.getElementById('sha256Output').value = '';
      document.getElementById('sha512Output').value = '';
      document.getElementById('sha1Output').value = '';
      document.getElementById('md5Output').value = '';
      return;
    }
    msgBytes = encodeText(input);
  }

  try {
    const keyBytes = hasKey ? encodeText(keyText) : null;

    const sha256 = hasKey ? await cryptoHmac('SHA-256', keyBytes, msgBytes) : await cryptoHash('SHA-256', msgBytes);
    if (token !== hashGenToken) return; // superseded by a newer keystroke
    document.getElementById('sha256Output').value = sha256;

    const sha512 = hasKey ? await cryptoHmac('SHA-512', keyBytes, msgBytes) : await cryptoHash('SHA-512', msgBytes);
    if (token !== hashGenToken) return;
    document.getElementById('sha512Output').value = sha512;

    const sha1 = hasKey ? await cryptoHmac('SHA-1', keyBytes, msgBytes) : await cryptoHash('SHA-1', msgBytes);
    if (token !== hashGenToken) return;
    document.getElementById('sha1Output').value = sha1;

    if (token !== hashGenToken) return;
    document.getElementById('md5Output').value = hasKey ? hmacMd5Bytes(keyBytes, msgBytes) : md5Bytes(msgBytes);
  } catch (e) {
    console.error('Error generating hashes:', e);
  }
}

function loadHashFile(inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    selectedFileBytes = new Uint8Array(e.target.result);
    const input = document.getElementById('hashInput');
    input.value = '';
    input.disabled = true;
    input.placeholder = `Hashing file: ${file.name} (${file.size.toLocaleString()} bytes)`;
    document.getElementById('hashFileClear').style.display = '';
    generateHashes();
  };
  reader.readAsArrayBuffer(file);
  inputEl.value = '';
}

function clearHashFile() {
  selectedFileBytes = null;
  const input = document.getElementById('hashInput');
  input.disabled = false;
  input.placeholder = 'Type or paste text to hash...';
  document.getElementById('hashFileClear').style.display = 'none';
  generateHashes();
}

