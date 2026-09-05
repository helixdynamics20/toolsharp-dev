// Single source of truth for every tool and guide on the site --
// path, display name, listing category, and the short description shown
// in the tools/index.html and guides/index.html directory listings.
//
// Isomorphic: loaded via <script src="/js/catalog.js"> in the browser
// (assigns window.TOOLSHARP_CATALOG), and via require() from build.js on
// the Node side, so both consume the exact same data instead of drifting.
//
// js/theme.js derives its palette/nav-dropdown/terminal lists from this at
// runtime instead of keeping its own copies. tools/index.html,
// guides/index.html, and llms.txt keep their own hand-written HTML/text
// (their prose differs in length and phrasing from the short desc here on
// purpose, so they aren't generated from this file) but build.js's
// validateRegistration() validates every path here appears in all three,
// failing the build loudly on drift instead of silently shipping a gap.
//
// toolCategories/guideCategories below are themselves the single source for
// which categories exist and what order they display in -- js/theme.js's
// nav dropdown and build.js's category-name validation both read this array
// directly rather than keeping their own copies, so a category can't drift
// the same way individual tools/guides used to.
//
// ── To add a new tool or guide ──
//   1. Add its .html file under tools/ or guides/.
//   2. Add an entry to the relevant array below (path/name/category/desc).
//      Reuse an existing `category` value, or see "to add a new category".
//   3. Add a matching <div class="dir-row"> to tools/index.html or
//      guides/index.html, under the right <div class="dir-category">
//      section (create one if using a new category -- see below).
//   4. Add a <url> entry to sitemap.xml and a line to llms.txt.
//   5. Run `node build.js` -- validateRegistration() fails loudly and
//      names the exact file if any of the above was missed.
// theme.js's palette, nav dropdown, and terminal all update automatically
// from step 2 alone; steps 3-4 are the only genuinely separate places left,
// since their prose is hand-written on purpose (see above).
//
// ── To add a new category ──
//   1. Add its name to toolCategories or guideCategories below, in the
//      position you want it to display (this is also its display label,
//      shown as "<name>/" -- keep it lowercase to match the others).
//   2. Tag the relevant entries with `category: '<name>'`.
//   3. Add the matching <div class="dir-category" id="cat-...">name/</div>
//      section to the index.html listing, in the same relative order.
// Skipping step 3 is caught at build time (validateRegistration() checks
// every category in this file has a matching section in the index page);
// skipping step 1 is also caught (an unrecognized category name fails the
// build immediately, naming the tool/guide and the bad category).
(function (root) {
  var TOOLSHARP_CATALOG = {
    toolCategories: ['json', 'encoding', 'text', 'hashes', 'dev-helpers'],
    guideCategories: ['.net', 'json', 'reference'],
    tools: [
      { path: '/tools/json-formatter', name: 'JSON Formatter & Minifier', category: 'json', desc: 'Validate, format, minify, or convert any JSON — errors show the exact line and column, duplicate keys are flagged even when valid JSON technically permits them' },
      { path: '/tools/appsettings-validator', name: 'AppSettings Validator', category: 'json', desc: 'Validate and pretty-print appsettings.json — catches JSON syntax errors with line/column, duplicate keys, empty connection strings, and plaintext secrets' },
      { path: '/tools/csv-json-converter', name: 'CSV / JSON Converter', category: 'json', desc: 'Convert CSV to JSON or JSON to CSV — proper quoted-field parsing handles embedded commas, quotes, and newlines; comma, semicolon, or tab delimiters' },
      { path: '/tools/base64-converter', name: 'Base64 Converter', category: 'encoding', desc: 'Encode text or files to Base64 (standard or URL-safe) and decode it back — handles UTF-8 correctly, supports drag-and-drop file input' },
      { path: '/tools/url-encoder', name: 'URL Encoder & Decoder', category: 'encoding', desc: 'Encode or decode URL / query string values, parse a full URL into its components (protocol, host, path, params, fragment), or build a URL from parts' },
      { path: '/tools/color-converter', name: 'Color Converter & Contrast Checker', category: 'encoding', desc: 'Convert between HEX, RGB, and HSL — auto-detects the format you paste in — plus a WCAG 2.1 contrast ratio checker with AA/AAA pass-fail badges' },
      { path: '/tools/qr-code-generator', name: 'QR Code Generator', category: 'encoding', desc: 'Generate a QR code from any text or URL — choose error correction level, size, and colors, then download as PNG or SVG' },
      { path: '/tools/diff-checker', name: 'Diff Checker', category: 'text', desc: 'Compare two texts side-by-side or in unified view with word or character precision — auto-compares as you type, supports file upload, hide unchanged lines' },
      { path: '/tools/sql-formatter', name: 'SQL Formatter & Beautifier', category: 'text', desc: 'Format and indent messy SQL queries or minify them for logging — supports T-SQL, PostgreSQL, MySQL; handles JOINs, subqueries, CTEs, and compound keywords' },
      { path: '/tools/case-converter', name: 'Case Converter', category: 'text', desc: 'Convert identifiers between camelCase, PascalCase, snake_case, kebab-case, CONSTANT_CASE, dot.case, and more — all nine formats at once, input format detected automatically' },
      { path: '/tools/xml-formatter', name: 'XML Formatter & Validator', category: 'text', desc: 'Format, validate, or minify XML — errors show the exact line and column; handles nested elements, attributes, comments, and CDATA correctly' },
      { path: '/tools/markdown-previewer', name: 'Markdown Previewer', category: 'text', desc: 'Live preview for Markdown — headings, lists, links, code blocks, tables, and blockquotes rendered as you type in a sandboxed preview pane' },
      { path: '/tools/share-pad', name: 'Share Pad', category: 'text', desc: 'Share text snippets via a short 6-digit code (stored temporarily server-side) or an offline URL-hash link where the full content is compressed into the URL itself' },
      { path: '/tools/hash-generator', name: 'Cryptographic Hash Generator', category: 'hashes', desc: 'Compute MD5, SHA-1, SHA-256, and SHA-512 hashes from any text — runs locally via the Web Crypto API, nothing is sent to any server' },
      { path: '/tools/connection-string-builder', name: 'Connection String Builder', category: 'dev-helpers', desc: 'Build or parse SQL Server connection strings — SQL auth, Windows auth, Azure AD, Encrypt and TrustServerCertificate flags, with runtime warnings for common mistakes' },
      { path: '/tools/cron-builder', name: 'Cron Builder & Explainer', category: 'dev-helpers', desc: 'Build and explain cron expressions for Hangfire (5-field) and Quartz.NET (6-field with seconds) — paste an expression to get a plain-English explanation' },
      { path: '/tools/jwt-decoder', name: 'JWT Decoder', category: 'dev-helpers', desc: 'Decode a JWT\'s header and payload, inspect all claims, check exp/nbf against the current time, and verify HS256 / RS256 / ES256 signatures in-browser' },
      { path: '/tools/epoch-converter', name: 'Epoch & Timestamp Converter', category: 'dev-helpers', desc: 'Convert Unix timestamps (seconds or milliseconds) to ISO 8601, UTC, and local time — live ticking clock, auto-detects seconds vs milliseconds' },
      { path: '/tools/guid-formatter', name: 'GUID Formatter & Generator', category: 'dev-helpers', desc: 'Generate a random GUID or reformat a pasted one across all five .NET Guid.ToString() formats — D, N, B, P, and the X hex-constructor form' },
      { path: '/tools/base-converter', name: 'Number Base Converter', category: 'dev-helpers', desc: 'Convert a number between binary, octal, decimal, and hexadecimal at once — full 64-bit range via BigInt, no precision loss on large values' },
      { path: '/tools/regex-tester', name: 'Regex Tester', category: 'dev-helpers', desc: 'Test a regex with live match and capture-group highlighting — pattern explanation panel, options mapped to .NET RegexOptions, C#/JS code generator' },
      { path: '/tools/password-generator', name: 'Password Generator', category: 'dev-helpers', desc: 'Generate cryptographically secure passwords or passphrases — configure length, character sets, exclude ambiguous chars, see entropy in bits, bulk generate up to 50 at once' },
      { path: '/tools/curl-converter', name: 'cURL Converter', category: 'dev-helpers', desc: 'Convert a curl command (including multi-line commands copied from browser DevTools) into working code — C#, Python, JavaScript, Node.js, PowerShell, Go, or Java — headers, body, basic auth, and the insecure flag all translated' },
    ],
    guides: [
      { path: '/guides/ef-core-migrations-already-up-to-date', name: 'EF Core: "The Database Is Already Up to Date"', category: '.net', desc: 'Update-Database says there\'s nothing to apply, but your migration never ran — usually EnsureCreated() and Migrate() disagreeing about what __EFMigrationsHistory should contain' },
      { path: '/guides/ef-core-10-complex-type-column-renaming', name: 'EF Core 10 Renamed Columns You Didn\'t Touch', category: '.net', desc: 'EF Core 10 renames complex-type columns you didn\'t touch — colliding names that used to silently share a column now get a numeric suffix, and nested types use the full property path' },
      { path: '/guides/sqlite-net10-datetimeoffset-utc-breaking-change', name: 'Microsoft.Data.Sqlite in .NET 10: DateTimeOffset Now Assumes UTC', category: '.net', desc: '.NET 10 silently changes what Microsoft.Data.Sqlite\'s GetDateTimeOffset() and GetDateTime() return — same code, same data, different timestamp, no error' },
      { path: '/guides/appsettings-secrets-in-git', name: 'appsettings.json Secrets Committed to Git', category: '.net', desc: 'A real secret got committed to appsettings.json and pushed — why deleting the line isn\'t enough, how to actually remove it from history, and rotating it either way' },
      { path: '/guides/hangfire-cron-wrong-day-explained', name: 'Hangfire Cron Job Running on the Wrong Day', category: '.net', desc: 'Why a Hangfire cron expression that validates fine still fires on the wrong day — Cronos, Quartz.NET, and traditional cron each number Sunday differently' },
      { path: '/guides/quartz-net-question-mark-explained', name: 'Quartz.NET "?" vs "*"', category: '.net', desc: 'The exact rule behind Quartz.NET\'s "day-of-week AND day-of-month" parse error, and why the ? character is required rather than optional' },
      { path: '/guides/sql-server-connection-string-examples', name: 'SQL Server Connection String Examples', category: '.net', desc: 'SQL auth, Windows auth, Azure AD, pooling, MARS, Connect vs Command timeout, and where the connection string lives in appsettings.json vs environment variables' },
      { path: '/guides/sql-server-keyword-not-supported-encrypt', name: '"Keyword Not Supported" and Certificate Trust Errors', category: '.net', desc: '"Keyword not supported" and certificate trust errors in SQL Server connection strings, and how both trace back to the same Microsoft.Data.SqlClient default change' },
      { path: '/guides/json-invisible-characters-explained', name: 'JSON Is Invalid But Looks Correct', category: 'json', desc: 'Why JSON copied from Jira, Confluence, or Word fails to parse at what looks like blank space — the 21 invisible Unicode characters responsible and how to actually find one' },
      { path: '/guides/json-unexpected-token-explained', name: 'Unexpected Token in JSON at Position N', category: 'json', desc: 'What JSON.parse\'s position number actually counts, why it usually points past your real mistake rather than at it, and how to convert it to a line and column yourself' },
      { path: '/guides/python-json-decode-error-explained', name: 'Python "JSONDecodeError: Expecting value"', category: 'json', desc: 'Python\'s "Expecting value: line 1 column 1 (char 0)" almost always means there\'s no JSON to parse yet — an empty response, an HTML error page, or a file path passed where a file object belongs' },
      { path: '/guides/unexpected-end-of-json-input-explained', name: '"Unexpected End of JSON Input"', category: 'json', desc: 'Why "Unexpected end of JSON input" means JSON.parse ran out of document, not that it found something wrong — almost always an empty or truncated fetch() response body' },
      { path: '/guides/powershell-convertfrom-json-invalid-primitive', name: 'PowerShell "ConvertFrom-Json: Invalid JSON primitive"', category: 'json', desc: '"Invalid JSON primitive" is often non-JSON text mixed into the pipeline, not bad JSON — plus the real parser difference between Windows PowerShell 5.1 and PowerShell 7+' },
      { path: '/guides/curl-data-json-content-type-explained', name: 'Why curl -d Doesn\'t Send application/json', category: 'json', desc: 'curl -d sends Content-Type: application/x-www-form-urlencoded by default even when the body is JSON — why that produces a null model or a 400, not a parse error, and the one-line fix' },
      { path: '/guides/cron-expression-cheat-sheet', name: 'Cron Expression Cheat Sheet', category: 'reference', desc: 'Every cron field explained, side-by-side Hangfire (5-field) and Quartz.NET (6-field) examples, and the mistakes that break schedules silently' },
      { path: '/guides/what-is-a-jwt', name: 'What Is a JWT?', category: 'reference', desc: 'What a JWT actually is, how its signature is computed, the algorithm-confusion attack, JWT vs session cookies, and why it can\'t be revoked before it expires' },
      { path: '/guides/regex-cheat-sheet', name: 'Regex Cheat Sheet', category: 'reference', desc: 'Anchors, character classes, greedy vs lazy, named groups across .NET/JS/Python/PCRE, lookaround, flags, and the catastrophic-backtracking mistake that has taken down production systems' },
      { path: '/guides/hashing-algorithms-explained', name: 'Hashing Algorithms Explained', category: 'reference', desc: 'Why SHA-256 is wrong for passwords, what bcrypt/scrypt/Argon2id do differently, current OWASP-recommended parameters, salting, HMAC, and the collision attacks that broke MD5 and SHA-1' },
      { path: '/guides/uuid-guid-versions-explained', name: 'UUID / GUID Versions Explained', category: 'reference', desc: 'What each UUID version (v1-v8) actually encodes, why RFC 9562\'s new v7 fixes a real database index performance problem, and the .NET byte-order quirk that breaks interop' },
      { path: '/guides/unix-timestamp-epoch-explained', name: 'Unix Timestamp & Epoch Time Explained', category: 'reference', desc: 'Why Unix time is UTC by definition, how DST makes local wall-clock time ambiguous twice a year, leap seconds, and a cross-language cheat sheet for getting "now" as epoch' },
      { path: '/guides/url-hash-fragment-explained', name: 'The URL Fragment That Never Reaches Your Server', category: 'reference', desc: 'Everything after # in a URL never reaches the server — verified with a real network capture — plus what OAuth and client-side routers use it for and where the guarantee actually ends' },
    ]
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TOOLSHARP_CATALOG;
  } else {
    root.TOOLSHARP_CATALOG = TOOLSHARP_CATALOG;
  }
})(typeof window !== 'undefined' ? window : this);
