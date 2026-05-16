// Stores push subscription in Upstash Redis
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'Invalid subscription' });

  try {
    await upstashSet('push-sub', JSON.stringify(subscription));
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error('subscribe error:', e);
    res.status(500).json({ error: 'Failed to store subscription' });
  }
}

async function upstashSet(key, value) {
  const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([['SET', key, value]]),
  });
  if (!r.ok) throw new Error(`Upstash error: ${r.status}`);
}
