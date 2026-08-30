// Exercises the api/*.mjs serverless functions locally against the real
// external services (Resend, Upstash), using the same handler code Vercel
// runs in production -- without needing `vercel dev` or a project link.
//
// Usage:
//   1. Copy .env.local.example to .env.local and fill in real values.
//   2. node --env-file=.env.local scripts/test-api-local.mjs
//
// Safe to run repeatedly: it sends one real test email via Resend and does
// one real read/write against Upstash, then reports pass/fail for each.

import contactHandler from '../api/contact.mjs';
import shareHandler from '../api/share.mjs';

function mockRes(label, expectedStatus) {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) {
      const ok = this.statusCode === expectedStatus;
      console.log(`${ok ? 'PASS' : 'FAIL'} [${label}] ${this.statusCode} ${JSON.stringify(body)}`);
      return this;
    }
  };
}

async function testContact() {
  console.log('\n--- api/contact.mjs ---');

  await contactHandler(
    { method: 'POST', headers: {}, body: { name: 'Bot', email: 'bot@example.com', message: 'spam', botcheck: 'on' } },
    mockRes('honeypot short-circuits without sending', 200)
  );

  await contactHandler(
    { method: 'POST', headers: {}, body: { name: 'Test', email: 'test@example.com' } },
    mockRes('missing message is rejected', 400)
  );

  await contactHandler(
    {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.1' },
      body: {
        name: 'Local test harness',
        email: 'toolsharpdev@gmail.com',
        topic: 'Bug report',
        message: 'This is a local test run via scripts/test-api-local.mjs -- confirms api/contact.mjs reaches Resend correctly.'
      }
    },
    mockRes('real submission sends via Resend (check inbox)', 200)
  );
}

async function testShare() {
  console.log('\n--- api/share.mjs ---');

  const code = 'testcode' + Date.now().toString(36);
  const value = 'local-test-value';

  await shareHandler(
    { method: 'POST', headers: { 'x-forwarded-for': '203.0.113.1' }, body: { code, value } },
    mockRes('write succeeds', 200)
  );

  await shareHandler(
    { method: 'GET', headers: { 'x-forwarded-for': '203.0.113.1' }, query: { code } },
    mockRes(`read back succeeds (result should be "${value}")`, 200)
  );
}

const target = process.argv[2];
if (!target || target === 'contact') await testContact();
if (!target || target === 'share') await testShare();
