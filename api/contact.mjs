// Keeps the Resend API key server-side only -- the browser posts here
// instead of api.resend.com directly, so the key never appears in page
// source or the client bundle.
async function checkRateLimit(url, token, ip) {
  const key = `contactlimit:${ip}`;
  const incrRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['INCR', key])
  });
  const { result: count } = await incrRes.json();
  // A malformed/unexpected Upstash response (no `result`, or a non-number)
  // must not silently fall through to `count <= 5` -- undefined/NaN
  // comparisons are always false in JS, which would reject a legitimate
  // message as over the limit with no real violation. Throwing here routes
  // it through the caller's fail-open handling instead.
  if (typeof count !== 'number') throw new Error(`Unexpected Upstash INCR response: ${JSON.stringify(count)}`);
  if (count === 1) {
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EXPIRE', key, 3600])
    });
  }
  return count <= 5; // 5 messages per IP per hour
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_TOKEN;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_TOKEN is missing on Vercel.' });
  }

  const { name, email, topic, message, botcheck } = req.body || {};

  // Honeypot: a real visitor never fills this field. Report success without
  // actually sending, so it doesn't tip off whatever filled it in.
  if (botcheck) {
    return res.status(200).json({ success: true });
  }

  if (!email || !message) {
    return res.status(400).json({ error: 'Missing email or message.' });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken) {
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    // Not wrapping this used to have two bad failure modes on any Upstash
    // hiccup (a network error, a non-JSON error body, a missing `result`
    // field): an unhandled rejection crashing the whole handler, or --
    // more insidiously -- `count` coming back undefined and silently
    // failing the `count <= 5` check (undefined <= 5 is false in JS),
    // rejecting a legitimate message as "too many messages sent" with no
    // actual rate-limit violation. Rate limiting is a defense-in-depth
    // measure here, not the contact form's actual job -- failing open
    // (let the message through) beats blocking real submissions because
    // the rate limiter itself had a bad moment.
    try {
      const withinLimit = await checkRateLimit(redisUrl, redisToken, ip);
      if (!withinLimit) {
        return res.status(429).json({ error: 'Too many messages sent. Try again later.' });
      }
    } catch (e) {
      console.error('Rate limit check failed, allowing the message through:', e);
    }
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'ToolSharp.dev Contact <onboarding@resend.dev>',
        to: 'toolsharpdev@gmail.com',
        reply_to: email,
        subject: `ToolSharp.dev contact: ${topic || 'General question'}`,
        text: `From: ${name || '(not provided)'} <${email}>\nTopic: ${topic || 'General question'}\n\n${message}`
      })
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({ error: data.message || 'Resend rejected the message.' });
    }
    return res.status(200).json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
