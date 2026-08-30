let qrGenToken = 0;

async function generateQr() {
  const text = document.getElementById('qrInput').value;
  const canvas = document.getElementById('qrCanvas');
  const empty = document.getElementById('qrEmpty');
  const actions = document.getElementById('qrActions');
  const errEl = document.getElementById('qrError');
  errEl.textContent = '';
  errEl.style.display = 'none';

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
    // Canvas pixels are invisible to screen readers -- describe what was
    // actually encoded instead of a generic "image" announcement.
    canvas.setAttribute('aria-label', text.length > 80
      ? `Generated QR code encoding: ${text.slice(0, 80)}…`
      : `Generated QR code encoding: ${text}`);
  } catch (e) {
    if (token !== qrGenToken) return;
    canvas.style.display = 'none';
    empty.style.display = 'none';
    actions.style.display = 'none';
    // qrcode throws when the text is too long for even the largest
    // version at the chosen error-correction level
    errEl.textContent = 'Could not generate a QR code: ' + e.message + '. Try a shorter input or a lower error-correction level.';
    errEl.style.display = '';
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

async function copyQrImage(btn) {
  const errEl = document.getElementById('qrError');
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard || !navigator.clipboard.write) {
    errEl.textContent = 'Copying an image isn\'t supported in this browser — use Download PNG instead.';
    errEl.style.display = '';
    return;
  }
  const canvas = document.getElementById('qrCanvas');
  canvas.toBlob(async (blob) => {
    if (!blob) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      if (typeof flashCopied === 'function') flashCopied(btn);
    } catch (e) {
      errEl.textContent = 'Could not copy the image: ' + e.message + '.';
      errEl.style.display = '';
    }
  }, 'image/png');
}

async function downloadSvg() {
  const text = document.getElementById('qrInput').value;
  if (!text.trim()) return;
  const level = document.getElementById('qrLevel').value;
  const dark = document.getElementById('qrDark').value || '#000000';
  const light = document.getElementById('qrLight').value || '#ffffff';
  const errEl = document.getElementById('qrError');

  let svg;
  try {
    svg = await window.QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: level,
      margin: 2,
      color: { dark: dark, light: light }
    });
  } catch (e) {
    errEl.textContent = 'Could not generate the SVG: ' + e.message + '. Try a shorter input or a lower error-correction level.';
    errEl.style.display = '';
    return;
  }
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
  persistFormState('qr-code-generator', ['qrLevel', 'qrScale', 'qrDark', 'qrLight']);
  document.getElementById('qrScaleVal').textContent = document.getElementById('qrScale').value;
  generateQr();
});

document.getElementById('qrInput').addEventListener('input', generateQr);
document.getElementById('qrLevel').addEventListener('change', generateQr);
document.getElementById('qrScale').addEventListener('input', function () {
  document.getElementById('qrScaleVal').textContent = this.value;
  generateQr();
});
document.getElementById('qrDark').addEventListener('input', generateQr);
document.getElementById('qrLight').addEventListener('input', generateQr);
document.getElementById('btnQrExample').addEventListener('click', tryQrExample);
document.getElementById('btnQrClear').addEventListener('click', clearQrInput);
document.getElementById('btnQrDownloadPng').addEventListener('click', downloadPng);
document.getElementById('btnQrDownloadSvg').addEventListener('click', downloadSvg);
document.getElementById('btnQrCopyImage').addEventListener('click', function () { copyQrImage(this); });
