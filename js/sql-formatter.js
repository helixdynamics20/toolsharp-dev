/* sql-formatter.js — ToolSharp.dev */
'use strict';

/* ── tokenizer ── */

function tokenizeSQL(sql) {
  const tokens = [];
  let i = 0;
  while (i < sql.length) {
    // single-line comment
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let j = i;
      while (j < sql.length && sql[j] !== '\n') j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j) });
      i = j; continue;
    }
    // block comment
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let j = i + 2;
      while (j < sql.length - 1 && !(sql[j] === '*' && sql[j + 1] === '/')) j++;
      tokens.push({ type: 'comment', value: sql.slice(i, j + 2) });
      i = j + 2; continue;
    }
    // string literal (single or double quote). A doubled quote ('' or "")
    // is the ANSI-standard escape every dialect here supports (T-SQL,
    // PostgreSQL, and MySQL in ANSI_QUOTES mode) -- e.g. 'O''Brien' is one
    // string, not two. A backslash before the closing quote (MySQL's
    // non-ANSI default) also doesn't end the string.
    if (sql[i] === "'" || sql[i] === '"') {
      const q = sql[i];
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === '\\' && j + 1 < sql.length) { j += 2; continue; }
        if (sql[j] === q) {
          if (sql[j + 1] === q) { j += 2; continue; }
          j++; break;
        }
        j++;
      }
      tokens.push({ type: 'string', value: sql.slice(i, j) });
      i = j; continue;
    }
    // bracket identifier [name] or `name`
    if (sql[i] === '[' || sql[i] === '`') {
      const close = sql[i] === '[' ? ']' : '`';
      let j = i + 1;
      while (j < sql.length && sql[j] !== close) j++;
      tokens.push({ type: 'identifier', value: sql.slice(i, j + 1) });
      i = j + 1; continue;
    }
    // whitespace
    if (/\s/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /\s/.test(sql[j])) j++;
      tokens.push({ type: 'whitespace', value: sql.slice(i, j) });
      i = j; continue;
    }
    // number
    if (/[0-9]/.test(sql[i]) || (sql[i] === '.' && /[0-9]/.test(sql[i + 1]))) {
      let j = i;
      while (j < sql.length && /[0-9.]/.test(sql[j])) j++;
      tokens.push({ type: 'number', value: sql.slice(i, j) });
      i = j; continue;
    }
    // word / keyword
    if (/[a-zA-Z_@#]/.test(sql[i])) {
      let j = i;
      while (j < sql.length && /[a-zA-Z0-9_@#$]/.test(sql[j])) j++;
      tokens.push({ type: 'word', value: sql.slice(i, j) });
      i = j; continue;
    }
    // punctuation / operator (multi-char) -- three-char operators must be
    // checked before their two-char prefix, or "->>"  (Postgres/MySQL JSON
    // text-extract) gets cut into "->" plus a stray ">".
    const three = sql.slice(i, i + 3);
    if (three === '->>') {
      tokens.push({ type: 'op', value: three });
      i += 3; continue;
    }
    const two = sql.slice(i, i + 2);
    if (['<>', '!=', '<=', '>=', '::', '||', '->'].includes(two)) {
      tokens.push({ type: 'op', value: two });
      i += 2; continue;
    }
    tokens.push({ type: 'punct', value: sql[i] });
    i++;
  }
  return tokens.filter(t => t.type !== 'whitespace');
}

/* ── merge compound keywords ── */

const COMPOUND = [
  ['GROUP', 'BY'], ['ORDER', 'BY'], ['PARTITION', 'BY'],
  ['LEFT', 'OUTER', 'JOIN'], ['RIGHT', 'OUTER', 'JOIN'], ['FULL', 'OUTER', 'JOIN'],
  ['LEFT', 'JOIN'], ['RIGHT', 'JOIN'], ['FULL', 'JOIN'],
  ['INNER', 'JOIN'], ['CROSS', 'JOIN'],
  ['INSERT', 'INTO'], ['DELETE', 'FROM'],
  ['UNION', 'ALL'], ['EXCEPT', 'ALL'], ['INTERSECT', 'ALL'],
  ['NOT', 'IN'], ['NOT', 'LIKE'], ['NOT', 'EXISTS'], ['NOT', 'NULL'], ['NOT', 'BETWEEN'],
  ['IS', 'NOT', 'NULL'], ['IS', 'NULL'],
  ['CREATE', 'TABLE'], ['CREATE', 'VIEW'], ['CREATE', 'INDEX'], ['CREATE', 'OR', 'REPLACE'],
  ['ALTER', 'TABLE'], ['DROP', 'TABLE'], ['DROP', 'VIEW'], ['DROP', 'INDEX'],
];

function mergeCompound(tokens) {
  const result = [];
  let i = 0;
  while (i < tokens.length) {
    if (tokens[i].type !== 'word') { result.push(tokens[i]); i++; continue; }
    let matched = false;
    for (const compound of COMPOUND) {
      if (compound.length > tokens.length - i) continue;
      let ok = true;
      for (let k = 0; k < compound.length; k++) {
        if (!tokens[i + k] || tokens[i + k].type !== 'word' ||
            tokens[i + k].value.toUpperCase() !== compound[k]) { ok = false; break; }
      }
      if (ok) {
        result.push({ type: 'word', value: compound.join(' ') });
        i += compound.length; matched = true; break;
      }
    }
    if (!matched) { result.push(tokens[i]); i++; }
  }
  return result;
}

/* ── classifier ── */

const CLAUSE_STARTERS = new Set([
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET',
  'UNION', 'UNION ALL', 'EXCEPT', 'EXCEPT ALL', 'INTERSECT', 'INTERSECT ALL',
  'WITH', 'INSERT INTO', 'INSERT', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM', 'DELETE',
  'MERGE', 'WHEN', 'THEN', 'ELSE', 'END',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN', 'JOIN',
  'ON', 'USING',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'CREATE OR REPLACE',
  'ALTER TABLE', 'DROP TABLE', 'DROP VIEW', 'DROP INDEX',
  'RETURNING', 'FETCH', 'FOR',
]);

const KEYWORDS = new Set([
  'SELECT', 'DISTINCT', 'ALL', 'TOP', 'FROM', 'WHERE', 'AND', 'OR', 'NOT',
  'IN', 'IS', 'NULL', 'LIKE', 'ILIKE', 'BETWEEN', 'EXISTS', 'ANY', 'SOME',
  'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
  'AS', 'ON', 'USING', 'HAVING', 'LIMIT', 'OFFSET', 'FETCH', 'NEXT', 'ROWS', 'ONLY', 'FIRST',
  'UNION', 'ALL', 'EXCEPT', 'INTERSECT', 'WITH', 'RECURSIVE',
  'INSERT', 'INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE', 'MERGE', 'UPSERT', 'REPLACE',
  'CREATE', 'TABLE', 'VIEW', 'INDEX', 'ALTER', 'DROP', 'TRUNCATE', 'RENAME',
  'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES', 'UNIQUE', 'DEFAULT', 'CONSTRAINT',
  'AUTO_INCREMENT', 'IDENTITY', 'SERIAL', 'GENERATED',
  'BEGIN', 'COMMIT', 'ROLLBACK', 'TRANSACTION', 'SAVEPOINT', 'RELEASE',
  'IF', 'ELSE', 'WHILE', 'RETURN', 'DECLARE', 'PRINT', 'EXEC', 'EXECUTE', 'CALL',
  'INNER', 'LEFT', 'RIGHT', 'FULL', 'OUTER', 'CROSS', 'JOIN',
  'GROUP', 'BY', 'ORDER', 'ASC', 'DESC', 'OVER', 'PARTITION', 'ROWS', 'RANGE', 'UNBOUNDED',
  'PRECEDING', 'FOLLOWING', 'CURRENT', 'ROW',
  'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'STRING_AGG', 'ARRAY_AGG',
  'COALESCE', 'ISNULL', 'NULLIF', 'NVL', 'IFNULL',
  'CAST', 'CONVERT', 'TRY_CAST', 'PARSE', 'FORMAT',
  'GETDATE', 'GETUTCDATE', 'NOW', 'CURRENT_TIMESTAMP', 'CURRENT_DATE', 'CURRENT_TIME',
  'DATEADD', 'DATEDIFF', 'DATEPART', 'DATENAME', 'DATE_TRUNC', 'DATE_PART',
  'EXTRACT', 'TO_CHAR', 'TO_DATE', 'TO_TIMESTAMP',
  'LEN', 'LENGTH', 'SUBSTRING', 'SUBSTR', 'CHARINDEX', 'POSITION', 'LOCATE',
  'UPPER', 'LOWER', 'TRIM', 'LTRIM', 'RTRIM', 'REPLACE', 'STUFF', 'CONCAT', 'CONCAT_WS',
  'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LEAD', 'LAG', 'FIRST_VALUE', 'LAST_VALUE',
  'INT', 'INTEGER', 'BIGINT', 'SMALLINT', 'TINYINT', 'DECIMAL', 'NUMERIC',
  'FLOAT', 'REAL', 'MONEY', 'SMALLMONEY',
  'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT', 'CLOB',
  'BIT', 'BOOLEAN', 'BOOL',
  'DATE', 'DATETIME', 'DATETIME2', 'DATETIMEOFFSET', 'TIMESTAMP', 'TIME', 'YEAR',
  'UNIQUEIDENTIFIER', 'UUID', 'JSON', 'JSONB', 'XML', 'VARBINARY', 'BINARY', 'BLOB',
  'RETURNING', 'OUTPUT', 'INTO',
  'NOT NULL', 'IS NULL', 'IS NOT NULL', 'NOT IN', 'NOT LIKE', 'NOT EXISTS', 'NOT BETWEEN',
  'GROUP BY', 'ORDER BY', 'PARTITION BY',
  'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'FULL JOIN', 'CROSS JOIN',
  'LEFT OUTER JOIN', 'RIGHT OUTER JOIN', 'FULL OUTER JOIN',
  'INSERT INTO', 'DELETE FROM', 'UNION ALL', 'EXCEPT ALL', 'INTERSECT ALL',
  'CREATE TABLE', 'CREATE VIEW', 'CREATE INDEX', 'CREATE OR REPLACE',
  'ALTER TABLE', 'DROP TABLE', 'DROP VIEW', 'DROP INDEX',
]);

// Keywords that keep a space before an opening paren (boolean/clause
// operators used for grouping — "AND (a OR b)", "IN (1,2,3)"). Everything
// else hugs the paren, including built-in function names that are also
// KEYWORDS entries (SUM, COUNT, CAST, CONCAT, ...): SUM(x), not SUM (x).
const SPACE_BEFORE_PAREN = new Set([
  'AND', 'OR', 'NOT', 'IN', 'NOT IN', 'EXISTS', 'NOT EXISTS',
  'VALUES', 'WHERE', 'ON', 'HAVING', 'SET', 'WHEN', 'RETURNING', 'USING',
]);

/* ── formatter ── */

function formatSQL(sql, opts = {}) {
  const { capitalize = true, indentSize = 2, commaStyle = 'end' } = opts;
  const pad = ' '.repeat(indentSize);
  const tokens = mergeCompound(tokenizeSQL(sql));

  let out = '';
  let depth = 0;
  let lineTokens = [];
  let parenDepthInLine = 0; // unclosed '(' currently sitting in lineTokens
  let parenStack = []; // 'subquery' | 'inline' per currently-open paren, matching each '(' to how it should format when its ')' arrives
  // Column-list state: while walking a comma-separated SELECT/GROUP BY/
  // ORDER BY list, listContinuation flips true after the *first* item is
  // flushed, so every following item (including the one flushed when the
  // next clause keyword arrives) gets +1 indent under the clause instead
  // of sitting flush-left with it.
  let inColumnList = false;
  let listContinuation = false;

  // ::, ->, and ->> (Postgres cast and JSON operators) are conventionally
  // written with no space on either side -- col::int, data->'key', not
  // col :: int.
  const TIGHT_OPS = new Set(['::', '->', '->>']);

  function smartJoin(toks) {
    let s = '';
    for (let j = 0; j < toks.length; j++) {
      const t = toks[j];
      const prev = toks[j - 1];
      if (t === '.') { s = s.trimEnd() + '.'; continue; }
      if (prev === '.') { s += t; continue; }
      if (TIGHT_OPS.has(t)) { s = s.trimEnd() + t; continue; }
      if (TIGHT_OPS.has(prev)) { s += t; continue; }
      if (t === ',' || t === ')') { s = s.trimEnd() + t; continue; }
      if (t === '(') {
        const prevUp = prev !== undefined ? prev.toUpperCase() : undefined;
        const needsSpace = prev === ',' || (prevUp !== undefined && SPACE_BEFORE_PAREN.has(prevUp));
        s += (s && needsSpace ? ' ' : '') + t;
        continue;
      }
      if (prev === '(') { s += t; continue; }
      s += (s ? ' ' : '') + t;
    }
    return s;
  }

  function flushLine(extraIndent = 0) {
    const line = smartJoin(lineTokens).trim();
    if (line) out += indent(depth + extraIndent) + line + '\n';
    lineTokens = [];
    parenDepthInLine = 0;
  }

  function indent(d) { return pad.repeat(Math.max(0, d)); }

  function kw(word) {
    return capitalize ? word.toUpperCase() : word.toLowerCase();
  }

  function isKw(word) { return KEYWORDS.has(word.toUpperCase()); }

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];
    const up = tok.value.toUpperCase();

    // comment: flush current line, output comment as-is, continue
    if (tok.type === 'comment') {
      flushLine();
      out += indent(depth) + tok.value + '\n';
      i++; continue;
    }

    // string literal or bracket identifier: add as-is
    if (tok.type === 'string' || tok.type === 'identifier') {
      lineTokens.push(tok.value);
      i++; continue;
    }

    // open paren: check if subquery follows
    if (tok.value === '(') {
      // peek ahead to see if next non-whitespace word is SELECT
      let peek = i + 1;
      while (peek < tokens.length && tokens[peek].type === 'whitespace') peek++;
      const nextUp = tokens[peek] ? tokens[peek].value.toUpperCase() : '';
      if (nextUp === 'SELECT' || nextUp === 'WITH') {
        flushLine();
        out += indent(depth) + '(\n';
        depth++;
        parenStack.push('subquery');
        inColumnList = false; listContinuation = false;
      } else {
        lineTokens.push('(');
        parenDepthInLine++;
        parenStack.push('inline');
      }
      i++; continue;
    }

    // close paren. Which kind of open paren this matches was decided (and
    // recorded on parenStack) when it was opened above -- inferring it
    // here from string-searching `out` (the previous approach) doesn't
    // work: out.trimEnd().endsWith('\n') can never be true, since
    // trimEnd() strips trailing newlines by definition. That made the
    // subquery-dedent branch dead code -- depth never decreased, so
    // everything after a closing subquery paren (an alias, the next
    // clause) inherited the wrong indent, worse the more it nested.
    if (tok.value === ')') {
      const kind = parenStack.length ? parenStack.pop() : 'inline';
      if (kind === 'subquery') {
        // Flush the subquery's own last line (e.g. "FROM t") at its
        // depth, *then* dedent, then start a fresh line with just ')' --
        // left pending in lineTokens so a following alias ("AS sub") or
        // another close paren joins it on the same line, exactly like
        // any other token would.
        flushLine();
        depth = Math.max(0, depth - 1);
        lineTokens.push(')');
        // A subquery is a real context change -- reset column-list
        // tracking. An ordinary inline paren (a function call, "IN (...)",
        // "FILTER (...)") closing is not: it's just one token among many
        // inside the current SELECT/GROUP BY/ORDER BY item, so it must
        // NOT clear inColumnList/listContinuation, or a list item with a
        // function call in it (e.g. "SUM(b) FILTER (WHERE c > 0)") loses
        // its indent the moment that inner paren closes.
        inColumnList = false; listContinuation = false;
      } else {
        lineTokens.push(')');
        parenDepthInLine = Math.max(0, parenDepthInLine - 1);
      }
      i++; continue;
    }

    // semicolon: end statement
    if (tok.value === ';') {
      flushLine();
      out += '\n;\n\n';
      depth = 0;
      parenStack = [];
      inColumnList = false; listContinuation = false;
      i++; continue;
    }

    // major clause keyword. Guarded to real top-level clause boundaries --
    // without the paren check, a keyword that's also a CLAUSE_STARTERS
    // entry but appears inside a function-call/grouping paren (ORDER BY or
    // PARTITION BY inside "OVER (...)", WHERE inside "FILTER (...)") would
    // wrongly break the line and reset parenDepthInLine, mangling the
    // window-function/filter expression across multiple dangling lines.
    // A currently-open 'subquery' paren is different -- WHERE/ORDER BY/etc.
    // inside "(SELECT ... WHERE ...)" are real clause boundaries for that
    // subquery, so only an 'inline' paren on top suppresses this.
    const insideInlineParen = parenStack.length > 0 && parenStack[parenStack.length - 1] === 'inline';
    if (tok.type === 'word' && CLAUSE_STARTERS.has(up) && !insideInlineParen) {
      flushLine((inColumnList && listContinuation) ? 1 : 0);
      // AND / OR inside WHERE get slight indent
      if (up === 'AND' || up === 'OR') {
        lineTokens.push(kw(up));
      } else {
        lineTokens.push(kw(tok.value));
        inColumnList = (up === 'SELECT' || up === 'GROUP BY' || up === 'ORDER BY');
        listContinuation = false;
      }
      i++; continue;
    }

    // comma
    if (tok.value === ',') {
      if (parenDepthInLine > 0) {
        // inside an unclosed function-call/list paren (e.g. CONCAT(a, b),
        // IN (1, 2, 3)) — this comma separates arguments, not clauses.
        lineTokens.push(',');
      } else {
        // First item of a column list sits on the clause's own line; every
        // item after that (and the final one, flushed above when the next
        // clause keyword arrives) gets +1 indent under the clause.
        const extra = (inColumnList && listContinuation) ? 1 : 0;
        if (commaStyle === 'leading') {
          flushLine(extra);
          lineTokens.push(',');
        } else {
          lineTokens.push(',');
          flushLine(extra);
        }
        listContinuation = true;
      }
      i++; continue;
    }

    // regular keyword
    if (tok.type === 'word' && isKw(up)) {
      lineTokens.push(kw(tok.value));
      i++; continue;
    }

    // everything else
    lineTokens.push(tok.value);
    i++;
  }

  flushLine((inColumnList && listContinuation) ? 1 : 0);

  // clean up: collapse excessive blank lines, trim trailing whitespace per line
  return out
    .split('\n')
    .map(l => l.trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ── minifier ── */

function minifySQL(sql) {
  const tokens = tokenizeSQL(sql);
  return tokens
    .filter(t => t.type !== 'comment' && t.type !== 'whitespace')
    .map((t, i, arr) => {
      const next = arr[i + 1];
      const sep = next && /[a-zA-Z0-9_@#]/.test(t.value.slice(-1)) &&
                  /[a-zA-Z0-9_@#]/.test(next.value[0]) ? ' ' : '';
      return t.value + sep;
    }).join('').trim();
}

/* ── UI ── */

let autoTimer = null;

function runFormat() {
  const sql = document.getElementById('sqlInput').value;
  if (!sql.trim()) { showResult('', 'Paste some SQL to format.', 'warn'); return; }
  const opts = {
    capitalize: document.getElementById('chkCapitalize').checked,
    indentSize: parseInt(document.getElementById('indentSize').value, 10) || 2,
    commaStyle: document.getElementById('commaStyle').value,
  };
  try {
    const formatted = formatSQL(sql, opts);
    showResult(formatted, null, null);
  } catch (e) {
    showResult('', 'Could not format: ' + e.message, 'error');
  }
}

function runMinify() {
  const sql = document.getElementById('sqlInput').value;
  if (!sql.trim()) { showResult('', 'Paste some SQL to minify.', 'warn'); return; }
  try {
    showResult(minifySQL(sql), null, null);
  } catch (e) {
    showResult('', 'Could not minify: ' + e.message, 'error');
  }
}

function showResult(sql, msg, type) {
  const out = document.getElementById('sqlOutput');
  const note = document.getElementById('sqlNote');
  out.value = sql;
  updateLineCount(sql);
  if (msg) {
    note.innerHTML = `<div class="callout ${type || 'warn'}">${escHtml(msg)}</div>`;
  } else {
    note.innerHTML = '';
  }
}

function updateLineCount(sql) {
  const el = document.getElementById('sqlLineCount');
  if (!sql) { el.textContent = ''; return; }
  const lines = sql.split('\n').length;
  el.textContent = `${lines} line${lines === 1 ? '' : 's'}`;
}

function clearAll() {
  document.getElementById('sqlInput').value = '';
  document.getElementById('sqlOutput').value = '';
  document.getElementById('sqlNote').innerHTML = '';
  document.getElementById('sqlLineCount').textContent = '';
}

function tryExample() {
  document.getElementById('sqlInput').value =
`select o.id,c.name,c.email,sum(oi.quantity*oi.unit_price) as total_amount,count(oi.id) as item_count from orders o inner join customers c on c.id=o.customer_id inner join order_items oi on oi.order_id=o.id where o.created_at>='2026-01-01' and o.status not in ('cancelled','refunded') group by o.id,c.name,c.email having sum(oi.quantity*oi.unit_price)>100 order by total_amount desc limit 50`;
  runFormat();
}

function scheduleAuto() {
  if (!document.getElementById('chkAuto').checked) return;
  clearTimeout(autoTimer);
  autoTimer = setTimeout(runFormat, 600);
}

function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}


document.addEventListener('DOMContentLoaded', () => {
  persistFormState('sql-formatter', ['chkCapitalize', 'indentSize', 'commaStyle', 'chkAuto']);
  document.getElementById('sqlInput').addEventListener('input', scheduleAuto);
});

document.getElementById('btnSqlFormat').addEventListener('click', runFormat);
document.getElementById('btnSqlMinify').addEventListener('click', runMinify);
document.getElementById('btnSqlExample').addEventListener('click', tryExample);
document.getElementById('btnSqlClear').addEventListener('click', clearAll);
