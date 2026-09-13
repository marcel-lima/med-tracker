// POST { key, value } — mirror a dose check so the server won't nag about it.
import { cmd } from '../server/redis.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { key, value, by } = req.body || {};
  if (!key || typeof key !== 'string') return res.status(400).json({ error: 'key required' });
  try {
    await cmd(value ? 'SADD' : 'SREM', 'checked', key);
    if (value && by) await cmd('HSET', 'checked-by', key, String(by).slice(0, 40));
    else if (!value) await cmd('HDEL', 'checked-by', key);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('checked error:', e);
    return res.status(500).json({ error: e.message });
  }
}
