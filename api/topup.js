// Called daily by a QStash schedule. Schedules the reminders that entered
// the 7-day window since the last run.
import { verifyQStash } from '../server/qstash.js';
import { scheduleWindow, pruneSched } from '../server/scheduler.js';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const v = await verifyQStash(req);
  if (!v.ok) return res.status(401).json({ error: 'invalid_signature', reason: v.reason });
  try {
    const pruned = await pruneSched();
    const scheduled = await scheduleWindow();
    return res.status(200).json({ ok: true, ...pruned, ...scheduled });
  } catch (e) {
    console.error('topup error:', e);
    return res.status(500).json({ error: e.message });
  }
}
