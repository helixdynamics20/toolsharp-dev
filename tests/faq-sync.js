// Checks every guide's FAQPage JSON-LD answer text matches its visible
// <details class="faq-item"> text exactly. Google's structured-data
// guidelines require this; it's drifted before (twice -- once across 19
// guides at once, once in a brand-new guide's first draft) because the two
// copies are hand-written independently with nothing keeping them in sync.
// Reads from the repo source (not dist/), same files build.js reads.

const fs = require('fs');
const path = require('path');

const GUIDES_DIR = path.join(__dirname, '..', 'guides');

function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
function stripTags(s) { return s.replace(/<[^>]+>/g, ''); }
function decodeEntities(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function run() {
  const files = fs.readdirSync(GUIDES_DIR).filter(f => f.endsWith('.html'));
  let filesWithFaq = 0, totalQA = 0, exact = 0;
  const mismatches = [];

  for (const f of files) {
    const content = fs.readFileSync(path.join(GUIDES_DIR, f), 'utf8');
    const ldMatch = content.match(/"@type":"FAQPage","mainEntity":(\[.*?\])\}\s*<\/script>/s);
    if (!ldMatch) continue;
    filesWithFaq++;

    let mainEntity;
    try { mainEntity = JSON.parse(ldMatch[1]); } catch (e) {
      mismatches.push(`${f}: JSON-LD PARSE ERROR -- ${e.message}`);
      continue;
    }

    const detailsRe = /<details class="faq-item">\s*<summary>(.*?)<\/summary>\s*<p>(.*?)<\/p>\s*<\/details>/gs;
    const visible = [];
    let m;
    while ((m = detailsRe.exec(content)) !== null) {
      visible.push({ q: norm(decodeEntities(stripTags(m[1]))), a: norm(decodeEntities(stripTags(m[2]))) });
    }

    if (visible.length !== mainEntity.length) {
      mismatches.push(`${f}: COUNT MISMATCH -- JSON-LD has ${mainEntity.length}, visible has ${visible.length}`);
    }

    const n = Math.min(visible.length, mainEntity.length);
    for (let i = 0; i < n; i++) {
      totalQA++;
      const ldQ = norm(decodeEntities(mainEntity[i].name));
      const ldA = norm(decodeEntities(mainEntity[i].acceptedAnswer.text));
      if (ldQ === visible[i].q && ldA === visible[i].a) exact++;
      else mismatches.push(`${f}: Q&A #${i + 1} text differs (JSON-LD vs visible <details>)`);
    }
  }

  console.log(`=== FAQ sync: ${filesWithFaq} guides with FAQ schema, ${totalQA} Q&A pairs, ${exact} exact matches ===`);
  if (mismatches.length) {
    console.log('MISMATCHES:');
    mismatches.forEach(m => console.log(' - ' + m));
  } else {
    console.log('All FAQ schema exactly matches its visible text.');
  }
  return mismatches.length === 0;
}

module.exports = { run };
