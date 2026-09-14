// GET    ?endpoint=…         — { devices, registered } for this device
// POST   { endpoint, keys }  — registers this device for push
// DELETE { endpoint }        — removes this device
import { addSubscription, removeSubscription, listSubscriptions } from '../server/push.js';

export default async function handler(req, res) {
  const body = req.body || {};
  try {
    if (req.method === 'GET') {
      const subs = await listSubscriptions();
      const endpoint = req.query?.endpoint;
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, devices: subs.length, registered: !!endpoint && subs.some(s => s.endpoint === endpoint) });
    }
    if (req.method === 'POST') {
      if (!body.endpoint) return res.status(400).json({ error: 'invalid_subscription' });
      await addSubscription(body);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      if (!body.endpoint) return res.status(400).json({ error: 'endpoint required' });
      await removeSubscription(body.endpoint);
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    console.error('subscribe error:', e);
    return res.status(500).json({ error: e.message });
  }
}
