// ── XML escaping (applied to the plain XML text itself, per the spec) ──
function escapeXmlText(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeXmlAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── HTML escaping for display only (matches json-formatter.js's approach:
// only &, <, > are escaped -- quotes are left as literal characters, since
// they're safe in text-node position inside a <pre>) ──
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function findLineCol(text, index) {
  const lines = text.slice(0, index).split('\n');
  return { line: lines.length, col: lines[lines.length - 1].length + 1 };
}

// ── parsing ──
function parseXmlDoc(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const errEl = doc.querySelector('parsererror');
  if (errEl) {
    const rawMsg = errEl.textContent.trim();
    let line, col;
    let m = /error on line (\d+)[^\d]+column (\d+)/i.exec(rawMsg);
    if (!m) m = /line number (\d+)[^\d]+column (\d+)/i.exec(rawMsg);
    if (!m) m = /(\d+):(\d+)/.exec(rawMsg);
    if (m) { line = parseInt(m[1], 10); col = parseInt(m[2], 10); }
    return { error: rawMsg, line, col };
  }
  return { doc };
}

function getXmlIndent() {
  const el = document.getElementById('xmlIndent');
  const v = el ? el.value : '2';
  return v === 'tab' ? '\t' : ' '.repeat(parseInt(v, 10) || 2);
}

// ── pretty-print: walk the parsed DOM and re-serialize with indentation ──
function serializeDoctype(node) {
  let s = '<!DOCTYPE ' + node.name;
  if (node.publicId) {
    s += ' PUBLIC "' + node.publicId + '"' + (node.systemId ? ' "' + node.systemId + '"' : '');
  } else if (node.systemId) {
    s += ' SYSTEM "' + node.systemId + '"';
  }
  s += '>';
  return s;
}

function isWhitespaceOnlyText(node) {
  return node.nodeType === 3 && node.nodeValue.trim() === '';
}

// xml:space="preserve" means whitespace inside that element is meaningful
// content, not formatting -- it must not be trimmed, collapsed, or
// re-indented. The attribute is inheritable: a descendant without its own
// xml:space keeps whatever the nearest ancestor set ("default" resets it).
function resolvePreserve(el, inherited) {
  const v = el.getAttribute && el.getAttribute('xml:space');
  if (v === 'preserve') return true;
  if (v === 'default') return false;
  return inherited;
}

// Re-serializes a subtree exactly as parsed -- no trimming, no added
// whitespace/indentation -- for use under an xml:space="preserve" element.
function serializeVerbatim(node) {
  switch (node.nodeType) {
    case 1: {
      const tagName = node.tagName;
      let open = '<' + tagName;
      for (let i = 0; i < node.attributes.length; i++) {
        const attr = node.attributes[i];
        open += ' ' + attr.name + '="' + escapeXmlAttr(attr.value) + '"';
      }
      if (node.childNodes.length === 0) return open + '/>';
      return open + '>' + Array.from(node.childNodes).map(serializeVerbatim).join('') + '</' + tagName + '>';
    }
    case 3: return escapeXmlText(node.nodeValue);
    case 4: return '<![CDATA[' + node.nodeValue + ']]>';
    case 8: return '<!--' + node.nodeValue + '-->';
    case 7: return '<?' + node.target + (node.nodeValue ? ' ' + node.nodeValue : '') + '?>';
    default: return '';
  }
}

function formatElement(el, depth, indentUnit, lines, preserveWs) {
  const indent = indentUnit.repeat(depth);
  const tagName = el.tagName;
  let open = '<' + tagName;
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    open += ' ' + attr.name + '="' + escapeXmlAttr(attr.value) + '"';
  }

  const effectivePreserve = resolvePreserve(el, preserveWs);
  if (effectivePreserve) {
    if (el.childNodes.length === 0) { lines.push(indent + open + '/>'); return; }
    const inner = Array.from(el.childNodes).map(serializeVerbatim).join('');
    lines.push(indent + open + '>' + inner + '</' + tagName + '>');
    return;
  }

  const children = Array.from(el.childNodes).filter(n => !isWhitespaceOnlyText(n));

  if (children.length === 0) {
    lines.push(indent + open + '/>');
    return;
  }

  // Inline a single text-only child: <tag>value</tag> on one line.
  if (children.length === 1 && children[0].nodeType === 3) {
    lines.push(indent + open + '>' + escapeXmlText(children[0].nodeValue.trim()) + '</' + tagName + '>');
    return;
  }
  // Inline a single CDATA-only child the same way.
  if (children.length === 1 && children[0].nodeType === 4) {
    lines.push(indent + open + '><![CDATA[' + children[0].nodeValue + ']]></' + tagName + '>');
    return;
  }

  lines.push(indent + open + '>');
  children.forEach(child => formatNode(child, depth + 1, indentUnit, lines, effectivePreserve));
  lines.push(indent + '</' + tagName + '>');
}

function formatNode(node, depth, indentUnit, lines, preserveWs) {
  const indent = indentUnit.repeat(depth);
  switch (node.nodeType) {
    case 1: // ELEMENT_NODE
      formatElement(node, depth, indentUnit, lines, preserveWs);
      break;
    case 3: { // TEXT_NODE (mixed content -- only reached when siblings exist)
      if (preserveWs) {
        lines.push(indent + escapeXmlText(node.nodeValue));
      } else {
        const t = node.nodeValue.trim();
        if (t) lines.push(indent + escapeXmlText(t));
      }
      break;
    }
    case 4: // CDATA_SECTION_NODE
      lines.push(indent + '<![CDATA[' + node.nodeValue + ']]>');
      break;
    case 8: // COMMENT_NODE
      lines.push(indent + '<!--' + node.nodeValue + '-->');
      break;
    case 7: // PROCESSING_INSTRUCTION_NODE
      lines.push(indent + '<?' + node.target + (node.nodeValue ? ' ' + node.nodeValue : '') + '?>');
      break;
    case 10: // DOCUMENT_TYPE_NODE
      lines.push(indent + serializeDoctype(node));
      break;
    default:
      break;
  }
}

function formatXmlString(text, indentUnit) {
  const lines = [];
  // DOMParser doesn't expose the <?xml ... ?> prolog as a node, so carry
  // it over verbatim from the source text if one was present.
  const declMatch = /^\s*<\?xml\s[^?]*\?>/i.exec(text);
  if (declMatch) lines.push(declMatch[0].trim());
  const result = parseXmlDoc(text);
  if (result.error) return result;
  Array.from(result.doc.childNodes).forEach(node => formatNode(node, 0, indentUnit, lines, false));
  return { formatted: lines.join('\n') };
}

// ── minify: same tree walk, no indentation, whitespace-only text nodes
// between tags dropped, meaningful text content left exactly as-is ──
function minifyElement(el, out, preserveWs) {
  const tagName = el.tagName;
  let open = '<' + tagName;
  for (let i = 0; i < el.attributes.length; i++) {
    const attr = el.attributes[i];
    open += ' ' + attr.name + '="' + escapeXmlAttr(attr.value) + '"';
  }

  const effectivePreserve = resolvePreserve(el, preserveWs);
  if (effectivePreserve) {
    if (el.childNodes.length === 0) { out.push(open + '/>'); return; }
    out.push(open + '>' + Array.from(el.childNodes).map(serializeVerbatim).join('') + '</' + tagName + '>');
    return;
  }

  const children = Array.from(el.childNodes).filter(n => !isWhitespaceOnlyText(n));
  if (children.length === 0) {
    out.push(open + '/>');
    return;
  }
  out.push(open + '>');
  children.forEach(child => minifyNode(child, out, effectivePreserve));
  out.push('</' + tagName + '>');
}

function minifyNode(node, out, preserveWs) {
  switch (node.nodeType) {
    case 1:
      minifyElement(node, out, preserveWs);
      break;
    case 3:
      if (preserveWs) {
        out.push(escapeXmlText(node.nodeValue));
      } else if (node.nodeValue.trim() !== '') {
        out.push(escapeXmlText(node.nodeValue));
      }
      break;
    case 4:
      out.push('<![CDATA[' + node.nodeValue + ']]>');
      break;
    case 8:
      out.push('<!--' + node.nodeValue + '-->');
      break;
    case 7:
      out.push('<?' + node.target + (node.nodeValue ? ' ' + node.nodeValue : '') + '?>');
      break;
    case 10:
      out.push(serializeDoctype(node));
      break;
    default:
      break;
  }
}

function minifyXmlString(text) {
  const out = [];
  const declMatch = /^\s*<\?xml\s[^?]*\?>/i.exec(text);
  if (declMatch) out.push(declMatch[0].trim());
  const result = parseXmlDoc(text);
  if (result.error) return result;
  Array.from(result.doc.childNodes).forEach(node => minifyNode(node, out, false));
  return { minified: out.join('') };
}

// ── syntax highlighting for the output pane, using the site's existing
// jt-* color classes (already defined in css/style.css for JSON) ──
function highlightXmlText(escaped) {
  const tokenRe = /&lt;!--[\s\S]*?--&gt;|&lt;!\[CDATA\[[\s\S]*?\]\]&gt;|&lt;\?[\s\S]*?\?&gt;|&lt;!DOCTYPE[\s\S]*?&gt;|(&lt;\/?)([A-Za-z_][\w:.\-]*)|"[^"]*"/g;
  return escaped.replace(tokenRe, (match, bracket, tagName) => {
    if (match.indexOf('&lt;!--') === 0) return `<span class="jt-null">${match}</span>`;
    if (match.indexOf('&lt;![CDATA[') === 0) return `<span class="jt-num">${match}</span>`;
    if (match.indexOf('&lt;!DOCTYPE') === 0) return `<span class="jt-null">${match}</span>`;
    if (match.indexOf('&lt;?') === 0) return `<span class="jt-null">${match}</span>`;
    if (bracket !== undefined) return `${bracket}<span class="jt-key">${tagName}</span>`;
    if (match.charAt(0) === '"') return `<span class="jt-str">${match}</span>`;
    return match;
  });
}

// ── rendering ──
function errorMsgHtml(result) {
  let locInfo = '';
  if (result.line) locInfo = ` (around line ${result.line}, column ${result.col})`;
  return `Not well-formed XML${locInfo}:<pre style="white-space:pre-wrap;margin:6px 0 0;font-size:12px;">${escapeHtml(result.error)}</pre>`;
}

function renderXmlResult(checks, outputText) {
  const resultDiv = document.getElementById('xmlResult');
  const hasOutput = outputText !== undefined;

  const outputHtml = hasOutput ? `
    <div class="config-block" style="margin-top:16px;">
      <div class="tab" style="display:flex;align-items:center;gap:6px;">
        <span style="flex:1;">output</span>
        <button class="copy-btn" onclick="copyElementValue('xmlOutputPre', this)">copy</button>
      </div>
      <div class="output-block">
        <pre id="xmlOutputPre">${highlightXmlText(escapeHtml(outputText))}</pre>
      </div>
    </div>` : '';

  resultDiv.innerHTML = `
    <div class="config-block">
      <div class="body">
        ${checks.map(c => `<div class="callout ${c.type}" style="margin-top:0; margin-bottom:10px;">${c.msg}</div>`).join('')}
      </div>
    </div>
    ${outputHtml}
  `;
}

function validateXmlOnly(text) {
  const result = parseXmlDoc(text);
  if (result.error) return { error: errorMsgHtml(result) };
  return { checks: [{ type: 'ok', msg: 'Well-formed XML.' }] };
}

let _pendingXmlPasteFormat = false;

function onXmlInput() {
  const text = document.getElementById('xmlInput').value;
  const wasPaste = _pendingXmlPasteFormat;
  _pendingXmlPasteFormat = false;

  if (!text.trim()) {
    document.getElementById('xmlResult').innerHTML = '<div class="config-block"><div class="output-block"><div class="empty">Paste XML on the left and click Format, Minify, or just start typing to validate.</div></div></div>';
    return;
  }

  const v = validateXmlOnly(text);
  if (v.error) {
    renderXmlResult([{ type: 'error', msg: v.error }]);
    return;
  }
  if (wasPaste) {
    const f = formatXmlString(text, getXmlIndent());
    if (f.error) { renderXmlResult([{ type: 'error', msg: errorMsgHtml(f) }]); return; }
    renderXmlResult(v.checks, f.formatted);
  } else {
    renderXmlResult(v.checks);
  }
}

function formatXml() {
  const text = document.getElementById('xmlInput').value;
  if (!text.trim()) return;
  const f = formatXmlString(text, getXmlIndent());
  if (f.error) {
    renderXmlResult([{ type: 'error', msg: errorMsgHtml(f) }]);
    return;
  }
  renderXmlResult([{ type: 'ok', msg: 'Well-formed XML.' }], f.formatted);
}

function minifyXml() {
  const text = document.getElementById('xmlInput').value;
  if (!text.trim()) return;
  const m = minifyXmlString(text);
  if (m.error) {
    renderXmlResult([{ type: 'error', msg: errorMsgHtml(m) }]);
    return;
  }
  renderXmlResult([{ type: 'ok', msg: 'Well-formed XML.' }], m.minified);
}


function clearXmlInput() {
  document.getElementById('xmlInput').value = '';
  onXmlInput();
}

const XML_EXAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<configuration>
  <!-- Application settings -->
  <appSettings>
    <add key="Environment" value="Production" />
    <add key="MaxRetryCount" value="3" />
  </appSettings>
  <connectionStrings>
    <add name="DefaultConnection" connectionString="Server=.;Database=AppDb;Trusted_Connection=True;" providerName="System.Data.SqlClient" />
  </connectionStrings>
  <system.web>
    <compilation debug="false" targetFramework="4.8" />
    <httpRuntime targetFramework="4.8" />
  </system.web>
  <notes><![CDATA[Internal note: rotate the DB credentials quarterly.]]></notes>
</configuration>`;

function tryXmlExample() {
  document.getElementById('xmlInput').value = XML_EXAMPLE;
  formatXml();
}

window.addEventListener('DOMContentLoaded', () => {
  persistFormState('xml-formatter', ['xmlIndent']);
  const inputEl = document.getElementById('xmlInput');
  if (inputEl) {
    // Same reasoning as json-formatter.js: flag the paste and re-read on
    // the following 'input' event rather than a fixed delay, so a large
    // paste isn't validated mid-write as a false "invalid" flash.
    inputEl.addEventListener('paste', () => { _pendingXmlPasteFormat = true; });
  }
});
