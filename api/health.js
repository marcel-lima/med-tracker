// GET /api/health — diagnóstico: quais variáveis existem e se Redis/QStash respondem.
// Nunca devolve valores de segredos, só presença e resultado das conexões.
import { cmd } from '../server/redis.js';

const REQUIRED = [
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
  'QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY',
];

async function timed(fn) {
  const t0 = Date.now();
  try { const value = await fn(); return { ok: true, value, ms: Date.now() - t0 }; }
  catch (e) { return { ok: false, error: e.message, cause: e.cause?.message || e.cause?.code || null, ms: Date.now() - t0 }; }
}

export default async function handler(req, res) {
  const env = Object.fromEntries(REQUIRED.map(k => [k, !!process.env[k]]));
  const redisHost = (() => { try { return new URL(process.env.UPSTASH_REDIS_REST_URL).host; } catch { return null; } })();

  const redis = env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? await timed(() => cmd('PING'))
    : { ok: false, error: 'variáveis do Redis ausentes' };

  const qstash = env.QSTASH_TOKEN
    ? await timed(async () => {
        const r = await fetch('https://qstash.upstash.io/v2/schedules', { headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` } });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const list = await r.json();
        return { schedules: Array.isArray(list) ? list.length : 0 };
      })
    : { ok: false, error: 'QSTASH_TOKEN ausente' };

  const subscription = redis.ok ? await timed(async () => !!(await cmd('GET', 'push-sub'))) : { ok: false };
  const treatment = redis.ok ? await timed(async () => !!(await cmd('GET', 'treatment'))) : { ok: false };

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    ok: redis.ok && qstash.ok && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT,
    env,
    redis: { ...redis, host: redisHost },
    qstash,
    stored: { subscription: subscription.value === true, treatment: treatment.value === true },
    node: process.version,
    region: process.env.VERCEL_REGION || null,
  });
}
