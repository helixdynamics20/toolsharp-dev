/* password-generator.js — ToolSharp.dev */
'use strict';

const UPPER  = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const LOWER  = 'abcdefghijklmnopqrstuvwxyz';
const DIGITS = '0123456789';
const SYMS   = '!@#$%^&*()-_=+[]{}|;:,.<>?';
const AMBIG  = /[0OIl1]/g;

/* ── word list for passphrases (~512 words → ~9 bits/word) ── */
const WORDS = `able about above acid across act aged ago air also among animal answer ant any ape arch area arm army art ask away axis baby back ball band base bath bear beat been bell belt best bill bird bite blow blue bold bolt bone book boot born both bowl brain brave bread bring brown brush build bulk burn burst call calm came card care cart case cast cave cell chip city clam clap clay clay clip coal coat coil cold come cook cool copy core corn cost crab crop crow cube cure curl dawn dead deal dear deep deny dial dirt disk dive dock dome done door door down draw drew drop drum dual dusk dust each earn east edge eight else emit epic ever exit face fact fair fall fame farm fast fate feed feel feet fell felt fern firm fish fist five flag flat flew flip flop flow foam fold folk fond font food fool form fork fort four free from fuel full fund game gate gave gear gene gift girl give glad glow glue goal goat goes gold golf gone good gust half hall hand hang hard hare harm harp hart hash have head heal heap heat heel help hemp herb herd high hill hint hole holy home hood hoop hope horn host hour huge hull hung hunt hurt icon idea idle inch into iris iron item jack join jump jury just keen keep kept kick kind king kite knot know lace laid lake lamb lamp land lane last late laud lawn lazy leaf lean left lend lens less lick lift like lime link lion list live load loam lock long look loop loss lost loud lure made mail main make male mall malt many mark mass mast mate math maze meal mean meet melt mend mesh mild mill mind mint miss mode mold moon most moth move much mule must myth nail name navy near neck need next node none noon norm nose note noun null oath once only open opus oral oval over pace pack page paid pale palm pant park part past path pawn peak peel peel peer pest pick pier pill pine pipe plan play plod plot plow plug plum plus poem pole poll pond poor port pose post pour pray prey prim prod prop pull pump pure push quad race rack rage rail rain rank rare rate read real reed reef reel rent rest rice rich ring riot rise risk road roam role roll roof room root rope rose rust safe said sail salt same sand save scan seal seam seed self self send sent ship shop shot silk sill sing sink site size skin skip slid slim slip slot slow slug snap soak soap sock soft soil sole some song soon sort soul span spin spit spot spun star stay stem step stop strap stub such suit sung sunk sure surf swam swan swap swat swim sync tail tale tame tape task tear teen tell tent term text than that then they thin this tide tilt time tiny tire toad told toll tomb tone took tool toss tour town trap tree trim trip true tuck tune turn twin type upon user vale vane vast veil vend vent view vine void vote wade wage wake walk wall wand ward warm warp wary wasp wave weak weed week well went were what when whim whip wick wide wild will wind wing wink wire wise wish with wolf worm worn wrap writ yarn year yell yoke yore your zeal zero zinc zone zoom`;

const WORD_LIST = WORDS.split(' ').filter(Boolean);

/* ── secure random integer ── */

function secureRandInt(n) {
  const arr = new Uint32Array(1);
  let limit = Math.floor(2 ** 32 / n) * n;
  do { crypto.getRandomValues(arr); } while (arr[0] >= limit);
  return arr[0] % n;
}

function secureRandChar(charset) {
  return charset[secureRandInt(charset.length)];
}

/* ── entropy calculation ── */

function entropyBits(length, charsetSize) {
  return Math.round(length * Math.log2(charsetSize));
}

function entropyLabel(bits) {
  if (bits < 28) return { label: 'very weak', cls: 'ent-very-weak' };
  if (bits < 40) return { label: 'weak',      cls: 'ent-weak' };
  if (bits < 56) return { label: 'fair',      cls: 'ent-fair' };
  if (bits < 80) return { label: 'strong',    cls: 'ent-strong' };
  return              { label: 'very strong', cls: 'ent-very-strong' };
}

/* ── password generator ── */

function buildCharset() {
  let charset = '';
  if (document.getElementById('chkUpper').checked)   charset += UPPER;
  if (document.getElementById('chkLower').checked)   charset += LOWER;
  if (document.getElementById('chkDigits').checked)  charset += DIGITS;
  if (document.getElementById('chkSymbols').checked) charset += SYMS;
  if (document.getElementById('chkNoAmbig').checked) charset = charset.replace(AMBIG, '');
  return charset;
}

function generateOne(length, charset) {
  if (!charset) return null;
  const mustContain = [];
  if (document.getElementById('chkUpper').checked)   mustContain.push(UPPER);
  if (document.getElementById('chkLower').checked)   mustContain.push(LOWER);
  if (document.getElementById('chkDigits').checked)  mustContain.push(DIGITS);
  if (document.getElementById('chkSymbols').checked) mustContain.push(SYMS);

  // guarantee at least one char from each enabled set
  const forced = mustContain.map(s => {
    let chars = s;
    if (document.getElementById('chkNoAmbig').checked) chars = chars.replace(AMBIG, '');
    return chars ? secureRandChar(chars) : '';
  }).filter(Boolean);

  if (forced.length > length) length = forced.length;

  const rest = Array.from({ length: length - forced.length },
    () => secureRandChar(charset));

  // shuffle forced + rest
  const all = [...forced, ...rest];
  for (let i = all.length - 1; i > 0; i--) {
    const j = secureRandInt(i + 1);
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.join('');
}

/* ── passphrase generator ── */

function generatePassphrase(count, separator) {
  const words = Array.from({ length: count },
    () => WORD_LIST[secureRandInt(WORD_LIST.length)]);

  const capitalize = document.getElementById('chkCapWords').checked;
  return words
    .map(w => capitalize ? w[0].toUpperCase() + w.slice(1) : w)
    .join(separator);
}

/* ── main generate ── */

let lastPasswords = [];
let lastMode = 'password';

function generate() {
  const mode = document.querySelector('input[name="genMode"]:checked').value;
  const metaEl = document.getElementById('pwMeta');
  const bulkN = parseInt(document.getElementById('bulkCount').value, 10) || 1;
  lastMode = mode;

  if (mode === 'passphrase') {
    const count = parseInt(document.getElementById('wordCount').value, 10) || 5;
    const sep   = document.getElementById('wordSep').value;
    const pws = Array.from({ length: bulkN }, () => generatePassphrase(count, sep));
    showPasswords(pws);
    const bits = Math.round(count * Math.log2(WORD_LIST.length));
    const { label, cls } = entropyLabel(bits);
    metaEl.innerHTML = entropyHtml(bits, label, cls) +
      `<span class="pw-meta-item">${WORD_LIST.length} word list</span>`;
    return;
  }

  const length  = parseInt(document.getElementById('pwLength').value, 10) || 16;
  const charset = buildCharset();
  if (!charset) {
    showPasswords([]);
    metaEl.innerHTML = '<span style="color:var(--red);">Select at least one character set.</span>';
    return;
  }

  const pws = Array.from({ length: bulkN }, () => generateOne(length, charset));
  showPasswords(pws);
  const bits = entropyBits(length, charset.length);
  const { label, cls } = entropyLabel(bits);
  metaEl.innerHTML = entropyHtml(bits, label, cls) +
    `<span class="pw-meta-item">${charset.length} possible chars</span>`;
}

/* ── result display: single textarea, or a numbered list once bulk > 1 ── */

function showPasswords(pws) {
  lastPasswords = pws;
  const resultEl = document.getElementById('pwResult');
  const listEl   = document.getElementById('pwList');

  if (pws.length > 1) {
    resultEl.style.display = 'none';
    listEl.style.display = '';
    listEl.innerHTML = pws.map((pw, i) => {
      const idx = String(i + 1).padStart(2, '0');
      return `<div class="pw-list-row"><span class="pw-list-idx">${idx}</span>` +
        `<span class="pw-list-val">${escHtml(pw)}</span>` +
        `<button class="pw-list-copy" onclick="copySingle(this, ${i})">copy</button></div>`;
    }).join('');
  } else {
    listEl.style.display = 'none';
    listEl.innerHTML = '';
    resultEl.style.display = '';
    resultEl.value = pws[0] || '';
  }
}

function entropyHtml(bits, label, cls) {
  return `<span class="pw-entropy ${cls}">${bits} bits — ${label}</span>`;
}

/* ── copy ── */

function copyPasswords(btn) {
  if (!lastPasswords.length) return;
  navigator.clipboard.writeText(lastPasswords.join('\n')).then(() => flash(btn, 'copied!', 'copy'));
}

function copySingle(btn, i) {
  const pw = lastPasswords[i];
  if (!pw) return;
  navigator.clipboard.writeText(pw).then(() => flash(btn, 'copied!', 'copy'));
}

/* ── download ── */

function downloadPasswords() {
  if (!lastPasswords.length) return;
  const blob = new Blob([lastPasswords.join('\n') + '\n'], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.href = url;
  a.download = `${lastMode === 'passphrase' ? 'passphrases' : 'passwords'}-${stamp}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* ── slider sync ── */

function syncSlider() {
  const val = document.getElementById('pwLength').value;
  document.getElementById('pwLengthNum').textContent = val;
}

function syncWordCount() {
  const val = document.getElementById('wordCount').value;
  document.getElementById('wordCountNum').textContent = val;
}

/* ── mode toggle ── */

function onModeChange() {
  const mode = document.querySelector('input[name="genMode"]:checked').value;
  document.getElementById('passwordOptions').style.display = mode === 'password' ? '' : 'none';
  document.getElementById('passphraseOptions').style.display = mode === 'passphrase' ? '' : 'none';
}

/* ── helpers ── */

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function flash(btn, active, orig) {
  btn.textContent = active;
  setTimeout(() => { btn.textContent = orig; }, 1500);
}

/* ── init ── */

document.addEventListener('DOMContentLoaded', () => {
  syncSlider();
  syncWordCount();
  generate();
});
