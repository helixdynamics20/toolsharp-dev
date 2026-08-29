// ── color format conversion helpers (pure, no DOM) ──────────────────────

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function round(v) {
  return Math.round(v);
}

// Parse an alpha component ("0.5" or "50%") to a 0-1 float.
function parseAlphaToken(token) {
  if (token === undefined) return 1;
  const t = token.trim();
  if (t.endsWith('%')) return clamp(parseFloat(t) / 100, 0, 1);
  return clamp(parseFloat(t), 0, 1);
}

// Parse a single rgb channel token ("255" or "100%") to 0-255 int.
function parseChannelToken(token) {
  const t = token.trim();
  if (t.endsWith('%')) return clamp(round(parseFloat(t) * 2.55), 0, 255);
  return clamp(round(parseFloat(t)), 0, 255);
}

function splitFnArgs(inner) {
  // Supports both legacy comma syntax "255, 0, 0, .5" and modern
  // space syntax "255 0 0 / 50%".
  let s = inner.trim();
  if (s.includes(',')) {
    return s.split(',').map(p => p.trim()).filter(Boolean);
  }
  return s.replace('/', ' ').split(/\s+/).map(p => p.trim()).filter(Boolean);
}

function parseHex(str) {
  let hex = str.trim().replace(/^#/, '');
  // #RGB and #RGBA shorthand both expand by doubling every digit
  // (#RGBA -> #RRGGBBAA), same rule, just four digits instead of three.
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length === 6 && /^[0-9a-f]{6}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: 1
    };
  }
  if (hex.length === 8 && /^[0-9a-f]{8}$/i.test(hex)) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: clamp(parseInt(hex.slice(6, 8), 16) / 255, 0, 1)
    };
  }
  return null;
}

function parseRgbFn(str) {
  const m = str.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = splitFnArgs(m[1]);
  if (parts.length < 3) return null;
  const r = parseChannelToken(parts[0]);
  const g = parseChannelToken(parts[1]);
  const b = parseChannelToken(parts[2]);
  if ([r, g, b].some(Number.isNaN)) return null;
  const a = parts.length > 3 ? parseAlphaToken(parts[3]) : 1;
  return { r, g, b, a };
}

function parseHslFn(str) {
  const m = str.trim().match(/^hsla?\(([^)]+)\)$/i);
  if (!m) return null;
  const parts = splitFnArgs(m[1]);
  if (parts.length < 3) return null;
  const h = parseFloat(parts[0]);
  const s = parseFloat(String(parts[1]).replace('%', ''));
  const l = parseFloat(String(parts[2]).replace('%', ''));
  if ([h, s, l].some(Number.isNaN)) return null;
  const a = parts.length > 3 ? parseAlphaToken(parts[3]) : 1;
  const rgb = hslToRgb(h, s, l);
  return { r: rgb.r, g: rgb.g, b: rgb.b, a };
}

// Auto-detect format (hex "#", rgb(), rgba(), hsl(), hsla()) and parse.
// Resolves a CSS named color ("tomato", "rebeccapurple", ...) by letting the
// browser's own CSS parser validate and normalize it, rather than hand-
// maintaining a 148-entry lookup table that could go stale or have typos.
const CSS_COLOR_KEYWORD_EXCLUDE = /^(inherit|initial|unset|revert|currentcolor)$/i;
function resolveNamedColor(name) {
  if (!/^[a-z]+$/i.test(name) || CSS_COLOR_KEYWORD_EXCLUDE.test(name)) return null;
  const probe = document.createElement('div');
  probe.style.color = name;
  if (!probe.style.color) return null; // the browser rejected the raw keyword outright
  // A detached element's own .style.color just echoes back the keyword
  // string -- getComputedStyle() is what actually resolves it to rgb(),
  // and that requires the element to be part of the rendered document.
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const m = computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] !== undefined ? +m[4] : 1 };
}

function parseColor(input) {
  if (!input) return null;
  const str = input.trim();
  if (!str) return null;
  if (str[0] === '#') return parseHex(str);
  if (/^rgba?\(/i.test(str)) return parseRgbFn(str);
  if (/^hsla?\(/i.test(str)) return parseHslFn(str);
  return resolveNamedColor(str);
}

function rgbToHex(r, g, b) {
  const h = n => clamp(round(n), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s;
  const l = (max + min) / 2;
  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: round(h * 360), s: round(s * 100), l: round(l * 100) };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s = clamp(s, 0, 100) / 100;
  l = clamp(l, 0, 100) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  return {
    r: clamp(round((r + m) * 255), 0, 255),
    g: clamp(round((g + m) * 255), 0, 255),
    b: clamp(round((b + m) * 255), 0, 255)
  };
}

function formatRgb(c) {
  return c.a < 1
    ? `rgba(${c.r}, ${c.g}, ${c.b}, ${+c.a.toFixed(2)})`
    : `rgb(${c.r}, ${c.g}, ${c.b})`;
}

function formatHsl(c) {
  const hsl = rgbToHsl(c.r, c.g, c.b);
  return c.a < 1
    ? `hsla(${hsl.h}, ${hsl.s}%, ${hsl.l}%, ${+c.a.toFixed(2)})`
    : `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}

// ── WCAG 2.1 contrast ──────────────────────────────────────────────────

function srgbChannelToLinear(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(r, g, b) {
  return 0.2126 * srgbChannelToLinear(r) + 0.7152 * srgbChannelToLinear(g) + 0.0722 * srgbChannelToLinear(b);
}

function contrastRatio(rgbA, rgbB) {
  const L1 = relativeLuminance(rgbA.r, rgbA.g, rgbA.b);
  const L2 = relativeLuminance(rgbB.r, rgbB.g, rgbB.b);
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Export for the standalone Node test harness; harmless in the browser
// since `module` is undefined there and this branch is skipped.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseColor, parseHex, parseRgbFn, parseHslFn,
    rgbToHex, rgbToHsl, hslToRgb, formatRgb, formatHsl,
    relativeLuminance, contrastRatio
  };
}

// ── DOM wiring ───────────────────────────────────────────────────────


function syncPickerFromColor(pickerId, c) {
  const picker = document.getElementById(pickerId);
  if (picker) picker.value = rgbToHex(c.r, c.g, c.b);
}

function convertColor() {
  const inputEl = document.getElementById('colorInput');
  const errorEl = document.getElementById('colorError');
  const swatchEl = document.getElementById('colorSwatch');
  const hexOut = document.getElementById('hexOutput');
  const rgbOut = document.getElementById('rgbOutput');
  const hslOut = document.getElementById('hslOutput');
  const value = inputEl.value;

  if (!value.trim()) {
    errorEl.style.display = 'none';
    hexOut.value = '';
    rgbOut.value = '';
    hslOut.value = '';
    swatchEl.style.background = 'transparent';
    swatchEl.textContent = '';
    return;
  }

  const c = parseColor(value);
  if (!c) {
    errorEl.textContent = `Could not parse "${value.trim()}" as a color. Try formats like #ff5733, rgb(255, 87, 51), or hsl(9, 100%, 60%).`;
    errorEl.style.display = 'block';
    hexOut.value = '';
    rgbOut.value = '';
    hslOut.value = '';
    swatchEl.style.background = 'transparent';
    swatchEl.textContent = '';
    return;
  }

  errorEl.style.display = 'none';
  hexOut.value = rgbToHex(c.r, c.g, c.b);
  rgbOut.value = formatRgb(c);
  hslOut.value = formatHsl(c);
  swatchEl.style.background = formatRgb(c);
  swatchEl.textContent = '';
  syncPickerFromColor('colorPicker', c);
}

function colorPickerChanged() {
  const picker = document.getElementById('colorPicker');
  document.getElementById('colorInput').value = picker.value;
  convertColor();
}

function tryColorExample() {
  document.getElementById('colorInput').value = 'rgb(108, 76, 224)';
  convertColor();
}

function clearColorInput() {
  document.getElementById('colorInput').value = '';
  convertColor();
}

// ── contrast checker ────────────────────────────────────────────────

const WCAG_THRESHOLDS = [
  { id: 'aaNormalPill', label: 'AA · Normal text', min: 4.5 },
  { id: 'aaLargePill', label: 'AA · Large text', min: 3 },
  { id: 'aaaNormalPill', label: 'AAA · Normal text', min: 7 },
  { id: 'aaaLargePill', label: 'AAA · Large text', min: 4.5 }
];

function updateContrast() {
  const fgVal = document.getElementById('fgInput').value;
  const bgVal = document.getElementById('bgInput').value;
  const errorEl = document.getElementById('contrastError');
  const resultEl = document.getElementById('contrastResult');
  const ratioEl = document.getElementById('contrastRatioValue');
  const previewEl = document.getElementById('contrastPreview');

  if (!fgVal.trim() || !bgVal.trim()) {
    errorEl.style.display = 'none';
    resultEl.style.display = 'none';
    return;
  }

  const fg = parseColor(fgVal);
  const bg = parseColor(bgVal);

  if (!fg || !bg) {
    const bad = !fg ? fgVal : bgVal;
    errorEl.textContent = `Could not parse "${bad.trim()}" as a color. Try formats like #111111, rgb(17, 17, 17), or hsl(0, 0%, 7%).`;
    errorEl.style.display = 'block';
    resultEl.style.display = 'none';
    return;
  }

  errorEl.style.display = 'none';
  resultEl.style.display = 'block';

  const ratio = contrastRatio(fg, bg);
  ratioEl.textContent = ratio.toFixed(2) + ' : 1';

  previewEl.style.background = formatRgb(bg);
  previewEl.style.color = formatRgb(fg);

  WCAG_THRESHOLDS.forEach(t => {
    const pill = document.getElementById(t.id);
    const pass = ratio >= t.min;
    pill.textContent = `${t.label}: ${pass ? 'Pass' : 'Fail'} (needs ${t.min}:1)`;
    pill.className = 'status-pill ' + (pass ? 's-ok' : 's-danger');
  });

  syncPickerFromColor('fgPicker', fg);
  syncPickerFromColor('bgPicker', bg);
}

function fgPickerChanged() {
  document.getElementById('fgInput').value = document.getElementById('fgPicker').value;
  updateContrast();
}

function bgPickerChanged() {
  document.getElementById('bgInput').value = document.getElementById('bgPicker').value;
  updateContrast();
}

function tryContrastExample() {
  document.getElementById('fgInput').value = '#767676';
  document.getElementById('bgInput').value = '#ffffff';
  updateContrast();
}

function clearContrast() {
  document.getElementById('fgInput').value = '';
  document.getElementById('bgInput').value = '';
  updateContrast();
}
