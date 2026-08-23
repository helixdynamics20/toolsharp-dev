export default async function handler(req, res) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return res.status(500).json({ error: "Upstash Redis environment variables are missing on Vercel." });
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
        body: JSON.stringify(['SET', code, value, 'EX', 2592000]) // 30 days TTL
      });

      const resData = await response.json();
      if (resData.error) {
        return res.status(500).json({ error: resData.error });
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
