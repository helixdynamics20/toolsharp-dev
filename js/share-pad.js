// Secure serverless database proxy endpoint
const API_URL = '../api/share';

async function compressText(text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const compressionStream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  const response = new Response(compressionStream);
  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function decompressText(code) {
  let base64 = code.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const decompressionStream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const response = new Response(decompressionStream);
  return await response.text();
}



// Generate a random 6-digit code
function generateCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return num.toString();
}

async function deriveKey(password, salt) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 1000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPayload(plaintext, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    key,
    enc.encode(plaintext)
  );
  
  const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, salt.length);
  combined.set(new Uint8Array(ciphertext), salt.length + iv.length);
  
  let binary = '';
  for (let i = 0; i < combined.byteLength; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function decryptPayload(encryptedBase64, password) {
  let base64 = encryptedBase64.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const combined = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    combined[i] = binary.charCodeAt(i);
  }
  
  const salt = combined.slice(0, 16);
  const iv = combined.slice(16, 28);
  const ciphertext = combined.slice(28);
  
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

async function generateShare() {
  const val = document.getElementById('plainInput').value;
  if (!val.trim()) return;
  
  const btn = document.getElementById('btnGenerate');
  btn.disabled = true;
  btn.textContent = 'Generating...';
  
  try {
    // 1. Generate offline compressed link
    const offlineHash = await compressText(val);
    const origin = window.location.origin + window.location.pathname;
    document.getElementById('offlineLink').value = origin + '#data=' + offlineHash;
    
    // 2. Generate sharing credentials
    let code = generateCode();
    
    // Encrypt client-side using the 6-digit code itself as the key
    const encryptedText = await encryptPayload(val, code);
    
    // Write ciphertext to the Vercel Serverless API
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, value: encryptedText })
    });
    
    if (!response.ok) {
      throw new Error('Database sharing failed.');
    }
    
    const resData = await response.json();
    if (resData.error) {
      throw new Error(resData.error);
    }
    
    // Format code as "123 456" for clean dictation
    const formattedCode = code.substring(0, 3) + ' ' + code.substring(3);
    document.getElementById('shareCode').value = formattedCode;
    document.getElementById('shareLink').value = origin + '#code=' + code;
    document.getElementById('outputBlock').style.display = 'block';
    clearError();
  } catch (e) {
    showError('Sharing failed: ' + e.message + '. Offline fallback link is still available below.');
    document.getElementById('outputBlock').style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Share';
  }
}

async function retrieveShare() {
  let input = document.getElementById('retrieveInput').value.trim();
  if (!input) return;
  
  const btn = document.getElementById('btnRetrieve');
  btn.disabled = true;
  btn.textContent = 'Retrieving...';
  
  try {
    let text = '';
    if (input.includes('#data=')) {
      // Offline fallback link
      const dataHash = input.split('#data=')[1];
      text = await decompressText(dataHash);
    } else {
      // Clean numeric code (remove spaces and hyphens)
      let cleaned = input.replace(/[\s-]/g, '');
      if (cleaned.includes('#code=')) {
        cleaned = cleaned.split('#code=')[1];
      }
      if (cleaned.length < 6) {
        throw new Error('Code must be 6 digits (e.g. 752 936)');
      }
      
      const code = cleaned.substring(0, 6);
      const pass = code;
      
      const response = await fetch(`${API_URL}?code=${code}`);
      if (!response.ok) {
        throw new Error('Code not found or expired.');
      }
      const resData = await response.json();
      if (resData.error || !resData.result) {
        throw new Error('Code not found or expired.');
      }
      const ciphertext = resData.result;
      text = await decryptPayload(ciphertext, pass);
    }
    
    document.getElementById('retrievedOutput').value = text;
    document.getElementById('retrieveOutputBlock').style.display = 'block';
    clearError();
  } catch (e) {
    showError('Failed to retrieve: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Retrieve Text';
  }
}

function copyValue(btn, id) {
  const el = document.getElementById(id);
  navigator.clipboard.writeText(el.value);
  flashCopied(btn);
}

function clearPlainInput() {
  document.getElementById('plainInput').value = '';
  document.getElementById('outputBlock').style.display = 'none';
  clearError();
}

function clearRetrieveInput() {
  document.getElementById('retrieveInput').value = '';
  document.getElementById('retrieveOutputBlock').style.display = 'none';
  clearError();
}

function showError(msg) {
  const el = document.getElementById('shareError');
  el.textContent = msg;
  el.style.display = 'block';
}

function clearError() {
  document.getElementById('shareError').style.display = 'none';
}

function copyAutoLoaded(btn) {
  const val = document.getElementById('autoLoadedOutput').value;
  navigator.clipboard.writeText(val);
  flashCopied(btn);
}

function dismissAutoLoaded() {
  document.getElementById('autoLoadedPanel').style.display = 'none';
  window.location.hash = '';
}

window.addEventListener('DOMContentLoaded', async () => {
  const hash = window.location.hash;
  if (hash.startsWith('#code=')) {
    try {
      const codeWithKey = hash.slice(6);
      const cleaned = codeWithKey.replace(/[\s-]/g, '');
      const code = cleaned.substring(0, 6);
      const pass = code;
      
      const response = await fetch(`${API_URL}?code=${code}`);
      if (response.ok) {
        const resData = await response.json();
        if (resData.result) {
          const decoded = await decryptPayload(resData.result, pass);
          document.getElementById('autoLoadedOutput').value = decoded;
          document.getElementById('autoLoadedPanel').style.display = 'block';
        } else {
          showError('The shared link has expired or is invalid.');
        }
      } else {
        showError('The shared link has expired or is invalid.');
      }
    } catch (e) {
      showError('Failed to retrieve or decrypt shared text.');
    }
  } else if (hash.startsWith('#data=')) {
    try {
      const code = hash.slice(6);
      const decoded = await decompressText(code);
      document.getElementById('autoLoadedOutput').value = decoded;
      document.getElementById('autoLoadedPanel').style.display = 'block';
    } catch (e) {
      showError('Failed to decompress shared link.');
    }
  }
});
