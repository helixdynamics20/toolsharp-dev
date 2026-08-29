// MD5 implementation in JavaScript (since Web Crypto doesn't support MD5)
function md5(string) {
  function k(n) { return Math.sin(n) * 0x100000000 | 0; }
  var b = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
      s = [
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

  // UTF-8 encode the string first
  var safeStr = unescape(encodeURIComponent(string));
  var n = safeStr.length,
      words = [];
  for (var i = 0; i < n; i++) {
    words[i >> 2] |= safeStr.charCodeAt(i) << ((i % 4) * 8);
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
  function hex(num) {
    var str = "", temp;
    for (var i = 0; i < 4; i++) {
      temp = (num >> (i * 8)) & 255;
      str += (temp < 16 ? "0" : "") + temp.toString(16);
    }
    return str;
  }
  return hex(h0) + hex(h1) + hex(h2) + hex(h3);
}

// Convert ArrayBuffer to Hex String
function bufferToHex(buffer) {
  var hexCodes = [];
  var view = new DataView(buffer);
  for (var i = 0; i < view.byteLength; i += 4) {
    var value = view.getUint32(i);
    var stringValue = value.toString(16);
    var padding = '00000000';
    var paddedValue = (padding + stringValue).slice(-8);
    hexCodes.push(paddedValue);
  }
  return hexCodes.join('');
}

// Helper to encode string to Uint8Array
function encodeText(text) {
  return new TextEncoder().encode(text);
}

// Web Crypto Hash Helper
async function cryptoHash(algo, text) {
  const msgUint8 = encodeText(text);
  const hashBuffer = await crypto.subtle.digest(algo, msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fires on every keystroke with no debounce, and each digest is itself
// async -- without a guard, an older (slower) call's writes could land
// after a newer call's, showing a hash that no longer matches the input.
let hashGenToken = 0;

async function generateHashes() {
  const input = document.getElementById('hashInput').value;
  const token = ++hashGenToken;

  if (!input) {
    document.getElementById('sha256Output').value = '';
    document.getElementById('sha512Output').value = '';
    document.getElementById('sha1Output').value = '';
    document.getElementById('md5Output').value = '';
    return;
  }

  try {
    const sha256 = await cryptoHash('SHA-256', input);
    if (token !== hashGenToken) return; // superseded by a newer keystroke
    document.getElementById('sha256Output').value = sha256;

    const sha512 = await cryptoHash('SHA-512', input);
    if (token !== hashGenToken) return;
    document.getElementById('sha512Output').value = sha512;

    const sha1 = await cryptoHash('SHA-1', input);
    if (token !== hashGenToken) return;
    document.getElementById('sha1Output').value = sha1;

    if (token !== hashGenToken) return;
    document.getElementById('md5Output').value = md5(input);
  } catch (e) {
    console.error('Error generating hashes:', e);
  }
}

