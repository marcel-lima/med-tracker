// POST — send a test notification to the stored subscription right now.
import { sendPush } from '../server/push.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const result = await sendPush({ title: 'Lembretes ativos', body: 'É assim que você vai receber os avisos.', tag: 'test', url: '/' });
    return res.status(200).json({ ok: true, result });
  } catch (e) {
    console.error('test-push error:', e);
    return res.status(500).json({ error: e.message });
  }
}
