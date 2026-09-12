// Turns the reminder list into QStash delayed messages, one per reminder.
// QStash free plan: max delay 7 days → we schedule a rolling window and a
// daily top-up (QStash schedule) fills the next days.
import { qstash, appUrl } from './qstash.js';
import { getJSON, hgetall, smembers, cmd, pipeline, del } from './redis.js';

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000 - 10 * 60 * 1000; // 7 days minus safety margin
export const TOPUP_SCHEDULE_ID = 'med-tracker-topup';

// Schedule every reminder that falls inside the window and isn't scheduled yet.
export async function scheduleWindow() {
  const reminders = (await getJSON('reminders')) || [];
  const sched = await hgetall('sched');
  const checked = new Set(await smembers('checked'));
  const now = Date.now();
  const horizon = now + WINDOW_MS;

  const due = reminders.filter(r =>
    r.at > now + 5000 &&
    r.at <= horizon &&
    !sched[r.key] &&
    !(r.doseKeys || []).every(k => checked.has(k))
  );
  if (!due.length) return { scheduled: 0 };

  const target = `${appUrl()}/api/send-push`;
  const results = await qstash().batchJSON(
    due.map(r => ({
      url: target,
      body: { key: r.key, title: r.title, body: r.body, doseKeys: r.doseKeys },
      notBefore: Math.floor(r.at / 1000),
      deduplicationId: `mt-${r.key}-${r.at}`,
      retries: 3,
    }))
  );

  const hset = [];
  results.forEach((res, i) => {
    const id = Array.isArray(res) ? res[0]?.messageId : res?.messageId;
    if (id) hset.push(['HSET', 'sched', due[i].key, id]);
  });
  await pipeline(hset);
  return { scheduled: hset.length };
}

// Cancel every scheduled message and forget them.
export async function cancelAll() {
  const sched = await hgetall('sched');
  const ids = Object.values(sched).filter(Boolean);
  if (ids.length) {
    try { await qstash().messages.deleteMany(ids); } catch (e) { console.warn('deleteMany:', e.message); }
  }
  await del('sched');
  return { cancelled: ids.length };
}

// Make sure the daily top-up schedule exists (idempotent: fixed scheduleId).
export async function ensureTopup() {
  await qstash().schedules.create({
    scheduleId: TOPUP_SCHEDULE_ID,
    destination: `${appUrl()}/api/topup`,
    cron: '0 3 * * *', // 03:00 UTC = 00:00 BRT
    retries: 3,
  });
}

export async function removeTopup() {
  try { await qstash().schedules.delete(TOPUP_SCHEDULE_ID); } catch { /* may not exist */ }
}

// Drop sched entries for reminders that are already in the past (housekeeping).
export async function pruneSched() {
  const reminders = (await getJSON('reminders')) || [];
  const byKey = new Map(reminders.map(r => [r.key, r]));
  const sched = await hgetall('sched');
  const stale = Object.keys(sched).filter(k => !byKey.has(k) || byKey.get(k).at < Date.now() - 60 * 60 * 1000);
  if (stale.length) await cmd('HDEL', 'sched', ...stale);
  return { pruned: stale.length };
}
