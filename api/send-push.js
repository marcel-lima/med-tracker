// Called by QStash at the exact reminder time.
// Body: { key, title, body, doseKeys }
// Skips silently if every dose of the slot was already marked as taken.
import { verifyQStash } from '../server/qstash.js';
import { sendPush } from '../server/push.js';
import { smembers, cmd } from '../server/redis.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const msg = await verifyQStash(req);
  if (msg === null) return res.status(401).json({ error: 'invalid_signature' });

  try {
    const doseKeys = msg.doseKeys || [];
    if (doseKeys.length) {
      const checked = new Set(await smembers('checked'));
      if (doseKeys.every(k => checked.has(k))) {
        if (msg.key) await cmd('HDEL', 'sched', msg.key);
        return res.status(200).json({ ok: true, skipped: 'already_taken' });
      }
    }

    const result = await sendPush({
      title: msg.title || 'Hora do remédio',
      body: msg.body || '',
      tag: `dose-${(msg.key || 'x').replace(/[^a-z0-9]/gi, '')}`,
      url: '/',
    });
    if (msg.key) await cmd('HDEL', 'sched', msg.key);
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    console.error('send-push error:', e);
    return res.status(500).json({ error: e.message });
  }
}
