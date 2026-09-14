// GET /api/health — diagnóstico: quais variáveis existem e se Redis/QStash respondem.
// Nunca devolve valores de segredos, só presença e resultado das conexões.
import { cmd, redisUrl, redisToken } from '../server/redis.js';
import { qstashBase } from '../server/qstash.js';

const REQUIRED = [
  'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
  'QSTASH_URL', 'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY',
];

async function timed(fn) {
  const t0 = Date.now();
  try { const value = await fn(); return { ok: true, value, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, error: e.message, cause: e.cause?.message || e.cause?.code || null, ms: Date.now() - t0 }; }
}

export default async function handler(req, res) {
  const env = Object.fromEntries(REQUIRED.map(k => [k, !!process.env[k]]));
  const redisHost = (() => { try { return new URL(redisUrl()).host; } catch { return null; } })();

  const redis = redisUrl() && redisToken()
    ? await timed(() => cmd('PING'))
    : { ok: false, error: 'variáveis do Redis ausentes' };

  const qstash = env.QSTASH_TOKEN
    ? await timed(async () => {
        const r = await fetch(`${qstashBase()}/v2/schedules`, { headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const list = await r.json();
        return { schedules: Array.isArray(list) ? list.length : 0 };
      })
    : { ok: false, error: 'QSTASH_TOKEN ausente' };

  const subscriptions = redis.ok ? await timed(async () => Number(await cmd('HLEN', 'push-subs')) + (await cmd('GET', 'push-sub') ? 1 : 0)) : { ok: false };
  const treatment = redis.ok ? await timed(async () => !!(await cmd('GET', 'treatment'))) : { ok: false };
  const scheduled = redis.ok ? await timed(async () => Number(await cmd('HLEN', 'sched'))) : { ok: false };
  const nextReminder = redis.ok ? await timed(async () => {
    const list = JSON.parse((await cmd('GET', 'reminders')) || '[]');
    const upcoming = list.filter(r => r.at > Date.now()).sort((a, b) => a.at - b.at);
    return upcoming.length ? { total: upcoming.length, next: new Date(upcoming[0].at).toISOString(), title: upcoming[0].title } : { total: 0 };
  }) : { ok: false };
  const recent = redis.ok ? await timed(async () => ((await cmd('LRANGE', 'push-log', 0, 9)) || []).map(x => { try { return JSON.parse(x); } catch { return x; } })) : { ok: false };
  const dlq = env.QSTASH_TOKEN ? await timed(async () => {
    const r = await fetch(`${qstashBase()}/v2/dlq?count=5`, { headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    const msgs = data.messages || [];
    return { failed: msgs.length, sample: msgs.slice(0, 3).map(m => ({ url: m.url, status: m.responseStatus, body: (m.responseBody || '').slice(0, 120) })) };
  }) : { ok: false };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: redis.ok && qstash.ok && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
    env,
    redis: { ...redis, host: redisHost },
    qstash: { ...qstash, base: qstashBase() },
    stored: { devices: subscriptions.value ?? 0, treatment: treatment.value === true, scheduledMessages: scheduled.value ?? 0 },
    reminders: nextReminder.value ?? null,
    deadLetters: dlq.value ?? dlq.error,
    recentDeliveries: recent.value ?? [],
    node: process.version,
    region: process.env.VERCEL_REGION || null,
  });
}
