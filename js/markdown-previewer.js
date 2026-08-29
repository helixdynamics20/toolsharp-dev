// Markdown preview: parses markdown via window.marked (vendored, see js/marked-lib.js)
// and renders the resulting HTML inside a sandboxed iframe (no allow-scripts) so any
// <script> or on*= handlers a user pastes in their own markdown can't execute.

let lastRenderedHtml = '';

const PREVIEW_STYLE = `
  body {
    margin: 0;
    padding: 16px 20px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 15px;
    line-height: 1.6;
    color: #24292f;
    background: #fff;
    word-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.2em 0 0.5em;
    font-weight: 600;
    line-height: 1.25;
  }
  h1 { font-size: 1.8em; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
  h2 { font-size: 1.4em; border-bottom: 1px solid #e1e4e8; padding-bottom: 0.3em; }
  h3 { font-size: 1.2em; }
  p { margin: 0.6em 0; }
  a { color: #0969da; text-decoration: none; }
  a:hover { text-decoration: underline; }
  ul, ol { padding-left: 1.8em; margin: 0.6em 0; }
  li { margin: 0.2em 0; }
  blockquote {
    margin: 0.8em 0;
    padding: 0 1em;
    color: #57606a;
    border-left: 0.25em solid #d0d7de;
  }
  code {
    font-family: ui-monospace, SFMono-Regular, "IBM Plex Mono", Consolas, monospace;
    font-size: 0.9em;
    background: rgba(175, 184, 193, 0.2);
    padding: 0.2em 0.4em;
    border-radius: 4px;
  }
  pre {
    background: #f6f8fa;
    padding: 12px 14px;
    border-radius: 6px;
    overflow-x: auto;
    line-height: 1.45;
  }
  pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    font-size: 0.88em;
  }
  table {
    border-collapse: collapse;
    margin: 0.8em 0;
    width: 100%;
  }
  th, td {
    border: 1px solid #d0d7de;
    padding: 6px 12px;
    text-align: left;
  }
  th { background: #f6f8fa; font-weight: 600; }
  img { max-width: 100%; }
  hr { border: none; border-top: 1px solid #e1e4e8; margin: 1.5em 0; }
`;

const EMPTY_MESSAGE = '<p style="color:#8b949e; font-style: italic;">Nothing to preview yet — type some markdown on the left.</p>';

let _mdInputTimer = null;

// Each keystroke re-parses the whole document and rewrites the iframe's
// srcdoc in full (forcing a full re-navigation of the sandboxed preview) --
// debounce plain typing so a long document doesn't re-render every character.
function scheduleRenderMarkdown() {
  clearTimeout(_mdInputTimer);
  _mdInputTimer = setTimeout(renderMarkdown, 200);
}

function renderMarkdown() {
  const input = document.getElementById('mdInput');
  const frame = document.getElementById('mdPreviewFrame');
  if (!input || !frame) return;

  const source = input.value;

  let html;
  if (!source.trim()) {
    html = '';
    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${PREVIEW_STYLE}</style></head><body>${EMPTY_MESSAGE}</body></html>`;
    lastRenderedHtml = '';
    return;
  }

  try {
    html = window.marked.parse(source);
  } catch (e) {
    html = '<p style="color:#cf222e;">Could not render this markdown.</p>';
  }

  lastRenderedHtml = html;
  frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${PREVIEW_STYLE}</style></head><body>${html}</body></html>`;
}

function clearMarkdownInput() {
  const input = document.getElementById('mdInput');
  if (input) input.value = '';
  renderMarkdown();
}

function tryMarkdownExample() {
  const input = document.getElementById('mdInput');
  if (!input) return;
  input.value = `# Project Notes

Welcome to the **markdown previewer** — this is a quick tour of *common* syntax.

## Features

- Live preview as you type
- Supports [links](https://toolsharp.dev), \`inline code\`, and more
- Nested lists work too

## Example code block

\`\`\`js
function greet(name) {
  return \`Hello, \${name}!\`;
}
\`\`\`

> Blockquotes are useful for callouts, tips, or quoting someone else's text.

That's the basics — try editing this to see the preview update live.
`;
  renderMarkdown();
}

function copyRenderedHtml(btn) {
  copyToClipboard(lastRenderedHtml, btn);
}

document.addEventListener('DOMContentLoaded', renderMarkdown);
