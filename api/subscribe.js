// POST — stores the web push subscription.
import { setJSON } from '../server/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const subscription = req.body;
  if (!subscription?.endpoint) return res.status(400).json({ error: 'invalid_subscription' });
  try {
    await setJSON('push-sub', subscription);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ error: e.message });
  }
}
