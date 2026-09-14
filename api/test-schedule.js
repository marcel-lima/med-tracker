// POST — schedules a real QStash message for ~1 minute from now, exercising
// the same path as dose reminders (QStash → signature check → push).
import { qstash, appUrl } from '../server/qstash.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const r = await qstash().publishJSON({
      url: `${appUrl()}/api/send-push`,
      body: { key: `test|${Date.now()}`, title: 'Teste agendado', body: 'Este aviso passou pelo agendador, como um lembrete de dose.', doseKeys: [] },
      delay: 60,
      retries: 2,
    });
    return res.status(200).json({ ok: true, messageId: r.messageId, at: new Date(Date.now() + 60000).toISOString() });
  } catch (e) {
    console.error('test-schedule error:', e);
    return res.status(500).json({ error: e.message });
  }
}
