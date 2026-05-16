// Called by GitHub Actions cron at each medication time.
// Query param: ?slot=HH:MM (e.g. ?slot=08:00)
// Also accepts a secret header to avoid abuse.
import webpush from 'web-push';

// ─── Schedule (must mirror src/lib/schedule.js) ───────────────────────────────
const MEDS = {
  amoxil:    { name: 'Amoxil' },
  tylenol:   { name: 'Tylenol Sinus' },
  predsim:   { name: 'Predsim' },
  aerolin:   { name: 'Aerolin' },
  rinossoro: { name: 'Rinossoro' },
};

const SCHEDULE = buildSchedule();

function buildSchedule() {
  const START = new Date(2026, 4, 15);
  const days = [];
  const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

  for (let i = 0; i < 11; i++) {
    const date = addD(START, i);
    let slots = [];
    if (i === 0) {
      slots = [
        { time: '18:00', meds: ['aerolin', 'rinossoro'], historic: true },
        { time: '23:00', meds: ['amoxil', 'tylenol', 'aerolin'] },
      ];
    } else if (i >= 1 && i <= 5) {
      slots = [
        { time: '08:00', meds: ['tylenol', 'predsim', 'rinossoro', 'aerolin'] },
        { time: '11:00', meds: ['amoxil'] },
        { time: '13:00', meds: ['aerolin', 'rinossoro'] },
        { time: '16:00', meds: ['tylenol'] },
        { time: '19:00', meds: ['aerolin', 'rinossoro'] },
        { time: '23:00', meds: ['amoxil', 'tylenol', 'aerolin'] },
      ];
    } else if (i === 6) {
      slots = [
        { time: '08:00', meds: ['rinossoro', 'aerolin'] },
        { time: '11:00', meds: ['amoxil'] },
        { time: '13:00', meds: ['aerolin', 'rinossoro'] },
        { time: '19:00', meds: ['aerolin', 'rinossoro'] },
        { time: '23:00', meds: ['amoxil', 'aerolin'] },
      ];
    } else if (i === 7) {
      slots = [
        { time: '08:00', meds: ['rinossoro', 'aerolin'] },
        { time: '11:00', meds: ['amoxil'] },
        { time: '13:00', meds: ['aerolin', 'rinossoro'] },
        { time: '19:00', meds: ['aerolin', 'rinossoro'] },
        { time: '23:00', meds: ['aerolin'] },
      ];
    } else if (i === 8 || i === 9) {
      slots = [
        { time: '08:00', meds: ['rinossoro', 'aerolin'] },
        { time: '13:00', meds: ['aerolin', 'rinossoro'] },
        { time: '19:00', meds: ['aerolin', 'rinossoro'] },
        { time: '23:00', meds: ['aerolin'] },
      ];
    } else {
      slots = [
        { time: '08:00', meds: ['aerolin'] },
        { time: '13:00', meds: ['aerolin'] },
        { time: '19:00', meds: ['aerolin'] },
        { time: '23:00', meds: ['aerolin'] },
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
    title: `Hora do remédio — ${slot}`,
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
