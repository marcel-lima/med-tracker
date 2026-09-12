// GET → { treatment, checked }  (lets a fresh device restore what another one saved)
// POST { treatment, reminders, checked }
// Replaces the treatment on the server and (re)schedules every reminder.
// treatment: null → clears everything and cancels all reminders.
import { setJSON, getJSON, smembers, del, cmd } from '../server/redis.js';
import { scheduleWindow, cancelAll, ensureTopup, removeTopup } from '../server/scheduler.js';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const [treatment, checked] = await Promise.all([getJSON('treatment'), smembers('checked')]);
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, treatment, checked });
    } catch (e) {
      console.error('treatment get error:', e);
      return res.status(500).json({ error: e.message });
    }
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const { treatment, reminders = [], checked = [] } = req.body || {};

  try {
    await cancelAll();

    if (!treatment || !Array.isArray(treatment.meds) || treatment.meds.length === 0) {
      await del('treatment', 'reminders', 'checked');
      await removeTopup();
      return res.status(200).json({ ok: true, cleared: true });
    }

    const clean = reminders
      .filter(r => r && r.key && Number.isFinite(r.at))
      .map(r => ({ key: String(r.key), at: Number(r.at), title: String(r.title || 'Hora do remédio'), body: String(r.body || ''), doseKeys: (r.doseKeys || []).map(String) }));

    await setJSON('treatment', treatment);
    await setJSON('reminders', clean);
    await del('checked');
    if (checked.length) await cmd('SADD', 'checked', ...checked.map(String));

    await ensureTopup();
    const result = await scheduleWindow();
    return res.status(200).json({ ok: true, reminders: clean.length, ...result });
  } catch (e) {
    console.error('treatment error:', e);
    return res.status(500).json({ error: e.message });
  }
}
