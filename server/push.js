import webpush from 'web-push';
import { cmd, hgetall, getJSON, del } from './redis.js';

// Subscriptions live in the hash `push-subs`: endpoint → subscription JSON.
// One entry per device, so several phones can receive the same reminders.
const HASH = 'push-subs';

let configured = false;
function ensureVapid() {
  if (configured) return;
  const missing = ['VAPID_SUBJECT', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY'].filter(k => !process.env[k]);
  if (missing.length) throw new Error(`faltam variáveis: ${missing.join(', ')}`);
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

export async function addSubscription(sub) {
  await cmd('HSET', HASH, sub.endpoint, JSON.stringify(sub));
}

export async function removeSubscription(endpoint) {
  await cmd('HDEL', HASH, endpoint);
}

export async function listSubscriptions() {
  const all = await hgetall(HASH);
  const subs = Object.values(all).map(v => { try { return JSON.parse(v); } catch { return null; } }).filter(Boolean);
  // Legacy single-subscription key: migrate it once.
  const legacy = await getJSON('push-sub');
  if (legacy?.endpoint) {
    await addSubscription(legacy);
    await del('push-sub');
    if (!subs.some(s => s.endpoint === legacy.endpoint)) subs.push(legacy);
  }
  return subs;
}

// Send one notification to every registered device.
// Returns { total, sent, expired, failed }.
export async function sendPush({ title, body, tag, url = '/' }) {
  ensureVapid();
  const subs = await listSubscriptions();
  const payload = JSON.stringify({ title, body, tag, url });
  const summary = { total: subs.length, sent: 0, expired: 0, failed: 0 };
  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(sub, payload);
      summary.sent++;
    } catch (e) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await removeSubscription(sub.endpoint);
        summary.expired++;
      } else {
        console.error('push error:', sub.endpoint.slice(0, 40), e.statusCode, e.body || e.message);
        summary.failed++;
      }
    }
  }));
  return summary;
}
