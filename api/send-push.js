// Called by GitHub Actions cron at each medication time.
// Query param: ?slot=HH:MM (e.g. ?slot=08:00)
// Also accepts a secret header to avoid abuse.
import webpush from 'web-push';

// ─── Schedule (must mirror src/lib/schedule.js) ───────────────────────────────
const MEDS = {
  seki:    { name: 'Seki Xarope' },
  levoxin: { name: 'Levoxin' },
  flancox: { name: 'Flancox' },
};

const SCHEDULE = buildSchedule();

function buildSchedule() {
  const START = new Date(2026, 4, 24);
  const days = [];
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  for (let i = 0; i < 7; i++) {
    const date = addD(START, i);
    let slots = [];
    if (i === 0) {
      slots = [
        { time: '08:00', meds: ['flancox'], historic: true },
        { time: '12:00', meds: ['seki', 'levoxin'], historic: true },
        { time: '20:00', meds: ['flancox'], historic: true },
        { time: '23:00', meds: ['seki'], historic: true },
      ];
    } else if (i >= 1 && i <= 4) {
      slots = [
        { time: '08:00', meds: ['seki', 'flancox'] },
        { time: '13:00', meds: ['seki', 'levoxin'] },
        { time: '20:00', meds: ['flancox'] },
        { time: '23:00', meds: ['seki'] },
      ];
    } else {
      slots = [
        { time: '13:00', meds: ['levoxin'] },
      ];
    }
    days.push({ date, slots });
  }
  return days;
}

function getMedsForSlot(slotTime) {
  // BRT = UTC-3
  const now = new Date();
  const brtNow = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const brtDate = new Date(brtNow.toISOString().split('T')[0]);

  for (const day of SCHEDULE) {
    const dayDate = new Date(day.date.toISOString().split('T')[0]);
    if (dayDate.getTime() === brtDate.getTime()) {
      const slot = day.slots.find((s) => s.time === slotTime && !s.historic);
      if (slot) return slot.meds.map((k) => MEDS[k].name);
    }
  }
  return null;
}

export default async function handler(req, res) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
  } catch (e) {
    return res.status(500).json({ error: 'vapid_init_failed', detail: e.message });
  }

  // Simple secret check to prevent abuse
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const slot = req.query.slot; // e.g. "08:00"
  if (!slot) return res.status(400).json({ error: 'slot param required' });

  const medNames = getMedsForSlot(slot);
  if (!medNames) {
    return res.status(200).json({ ok: true, msg: 'no meds scheduled for this slot today' });
  }

  // Get subscription from Upstash
  const subJson = await upstashGet('push-sub');
  if (!subJson) return res.status(200).json({ ok: true, msg: 'no subscription stored' });

  const subscription = JSON.parse(subJson);

  const payload = JSON.stringify({
    title: `Time for your meds — ${slot}`,
    body: medNames.join(', '),
    tag: `dose-${slot.replace(':', '')}`,
    url: '/',
  });

  try {
    await webpush.sendNotification(subscription, payload);
    res.status(200).json({ ok: true, meds: medNames });
  } catch (e) {
    console.error('push error:', e);
    if (e.statusCode === 410 || e.statusCode === 404) {
      await upstashDel('push-sub');
      return res.status(200).json({ ok: true, msg: 'subscription expired, removed' });
    }
    res.status(500).json({ error: e.message });
  }
}

async function upstashGet(key) {
  const r = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
  const { result } = await r.json();
  return result;
}

async function upstashDel(key) {
  await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/del/${key}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` },
  });
}
