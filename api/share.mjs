// The share code is only 6 digits (1,000,000 possibilities) and doubles as
// the client-side encryption password, so anyone who can guess/enumerate a
// valid code already has everything needed to decrypt it -- there's no
// separate secret to brute-force. The only real defense is making
// enumeration slow: a simple per-IP request cap using the same Redis
// instance we already talk to, no extra service required.
async function checkRateLimit(url, token, ip) {
  const key = `ratelimit:${ip}`;
  const incrRes = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['INCR', key])
  });
  const { result: count } = await incrRes.json();
  if (count === 1) {
    // first request in this window -- start the clock
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(['EXPIRE', key, 60])
    });
  }
  return count <= 20; // 20 requests per IP per 60 seconds
}

export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: "Upstash Redis environment variables are missing on Vercel." });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const withinLimit = await checkRateLimit(url, token, ip);
  if (!withinLimit) {
    return res.status(429).json({ error: "Too many requests. Try again in a minute." });
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
