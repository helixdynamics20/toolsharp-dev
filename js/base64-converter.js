function encode() {
  const text = document.getElementById('plainText').value;
  const isUrlSafe = document.getElementById('urlSafe').checked;
  if (!text) {
    document.getElementById('base64Text').value = '';
    clearError();
    return;
  }
  try {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    let base64 = btoa(binary);
    if (isUrlSafe) {
      base64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    }
    document.getElementById('base64Text').value = base64;
    clearError();
  } catch (e) {
    showError(e.message);
  }
}

function decode() {
  let base64 = document.getElementById('base64Text').value.trim();
  const isUrlSafe = document.getElementById('urlSafe').checked;
  if (!base64) {
    document.getElementById('plainText').value = '';
    clearError();
    return;
  }
  try {
    if (isUrlSafe) {
      base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) {
        base64 += '=';
      }
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const decoded = new TextDecoder().decode(bytes);
    document.getElementById('plainText').value = decoded;
    clearError();
  } catch (e) {
    showError('Invalid Base64 string: ' + e.message);
  }
}

function onUrlSafeToggle() {
  // Recalculate based on active values
  const plain = document.getElementById('plainText').value;
  if (plain) {
    encode();
  } else {
    const b64 = document.getElementById('base64Text').value;
    if (b64) {
      decode();
    }
  }
}

function showError(msg) {
  const errDiv = document.getElementById('base64Error');
  errDiv.textContent = msg;
  errDiv.style.display = 'block';
}

function clearError() {
  document.getElementById('base64Error').style.display = 'none';
}

// Copy/Clear Handlers
function copyPlaintext() {
  const val = document.getElementById('plainText').value;
  navigator.clipboard.writeText(val);
}

function clearPlaintext() {
  document.getElementById('plainText').value = '';
  document.getElementById('base64Text').value = '';
  clearError();
}

function copyBase64() {
  const val = document.getElementById('base64Text').value;
  navigator.clipboard.writeText(val);
}

function clearBase64() {
  document.getElementById('plainText').value = '';
  document.getElementById('base64Text').value = '';
  clearError();
}
