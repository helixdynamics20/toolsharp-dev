// The share code is only 6 digits (1,000,000 possibilities) and doubles as
// the client-side encryption password, so anyone who can guess/enumerate a
// valid code already has everything needed to decrypt it -- there's no
// separate secret to brute-force. The only real defense is making
// enumeration slow: a simple per-IP request cap using the same Redis
// instance we already talk to, no extra service required.
import { checkRateLimit } from './_lib/rate-limit.mjs';

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: "Upstash Redis environment variables are missing on Vercel." });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  // Not wrapping this used to mean any Upstash hiccup during the rate-limit
  // check (a network error, a malformed response) either crashed the whole
  // request with an unhandled rejection, or -- since `count` coming back
  // undefined makes `count <= 20` false -- silently rejected a legitimate
  // save/retrieve as rate-limited with no real violation. Notably
  // inconsistent with the SET/GET calls below, which already handle their
  // own Upstash failures gracefully; the rate-limit check (a lighter
  // defense-in-depth guard, not this endpoint's actual job) was the one
  // path that wasn't. Failing open here doesn't meaningfully weaken the
  // guard either: an Upstash outage severe enough to break this INCR call
  // would very likely break the SET/GET call right after it too, on the
  // same Redis instance.
  try {
    const withinLimit = await checkRateLimit(url, token, `ratelimit:${ip}`, 60, 20); // 20 requests per IP per 60 seconds
    if (!withinLimit) {
      return res.status(429).json({ error: "Too many requests. Try again in a minute." });
    }
  } catch (e) {
    console.error('Rate limit check failed, allowing the request through:', e);
  }

  // Handle write (POST)
  if (req.method === 'POST') {
    const { code, value } = req.body;
    if (!code || !value) {
      return res.status(400).json({ error: "Missing code or value payload." });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['SET', code, value, 'NX', 'EX', 2592000]) // 30 days TTL, only if not already set
      });

      const resData = await response.json();
      if (resData.error) {
        return res.status(500).json({ error: resData.error });
      }
      if (resData.result === null) {
        return res.status(409).json({ error: "That code is already in use -- try again." });
      }
      return res.status(200).json({ success: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Handle read (GET)
  else if (req.method === 'GET') {
    const { code } = req.query;
    if (!code) {
      return res.status(400).json({ error: "Missing code parameter." });
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(['GET', code])
      });

      const resData = await response.json();
      if (resData.error) {
        return res.status(500).json({ error: resData.error });
      }
      return res.status(200).json({ result: resData.result });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  } 
  
  else {
    return res.status(405).json({ error: "Method not allowed" });
  }
}
