let qrGenToken = 0;

async function generateQr() {
  const text = document.getElementById('qrInput').value;
  const canvas = document.getElementById('qrCanvas');
  const empty = document.getElementById('qrEmpty');
  const actions = document.getElementById('qrActions');
  const errEl = document.getElementById('qrError');
  errEl.textContent = '';

  if (!text.trim()) {
    canvas.style.display = 'none';
    empty.style.display = '';
    actions.style.display = 'none';
    return;
  }

  const token = ++qrGenToken; // guards against a slow render finishing after a newer one starts
  const level = document.getElementById('qrLevel').value;
  const scale = parseInt(document.getElementById('qrScale').value, 10) || 6;
  const dark = document.getElementById('qrDark').value || '#000000';
  const light = document.getElementById('qrLight').value || '#ffffff';

  try {
    await window.QRCode.toCanvas(canvas, text, {
      errorCorrectionLevel: level,
      scale: scale,
      margin: 2,
      color: { dark: dark, light: light }
    });
    if (token !== qrGenToken) return;
    canvas.style.display = 'block';
    empty.style.display = 'none';
    actions.style.display = '';
  } catch (e) {
    if (token !== qrGenToken) return;
    canvas.style.display = 'none';
    empty.style.display = 'none';
    actions.style.display = 'none';
    // qrcode throws when the text is too long for even the largest
    // version at the chosen error-correction level
    errEl.textContent = 'Could not generate a QR code: ' + e.message + '. Try a shorter input or a lower error-correction level.';
  }
}

function downloadPng() {
  const canvas = document.getElementById('qrCanvas');
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'qrcode.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function downloadSvg() {
  const text = document.getElementById('qrInput').value;
  if (!text.trim()) return;
  const level = document.getElementById('qrLevel').value;
  const dark = document.getElementById('qrDark').value || '#000000';
  const light = document.getElementById('qrLight').value || '#ffffff';

  const svg = await window.QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: level,
    margin: 2,
    color: { dark: dark, light: light }
  });
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'qrcode.svg';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearQrInput() {
  document.getElementById('qrInput').value = '';
  generateQr();
}

function tryQrExample() {
  document.getElementById('qrInput').value = 'https://toolsharp.dev';
  generateQr();
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('qrScaleVal').textContent = document.getElementById('qrScale').value;
});
