// Minimal Upstash Redis REST client (no SDK needed).
// Keys used by the app:
//   treatment   JSON  — current treatment (mirrors the app)
//   reminders   JSON  — [{ key, at, title, body, doseKeys }]
//   sched       HASH  — reminderKey → QStash messageId (what is already scheduled)
//   checked     SET   — dose keys the user marked as taken
//   push-sub    JSON  — web push subscription

// The Upstash integration on Vercel names these KV_REST_API_*; older setups
// used UPSTASH_REDIS_REST_*. Accept both, preferring the integration's.
export const redisUrl = () => process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
export const redisToken = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const url = redisUrl;
const token = redisToken;

export async function cmd(...args) {
  const r = await fetch(url(), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args.map(a => (typeof a === 'string' ? a : String(a)))),
  });
  const data = await r.json();
  if (!r.ok || data.error) throw new Error(`redis ${args[0]}: ${data.error || r.status}`);
  return data.result;
}

export async function pipeline(commands) {
  if (!commands.length) return [];
  const r = await fetch(`${url()}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands.map(c => c.map(a => (typeof a === 'string' ? a : String(a))))),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(`redis pipeline: ${r.status}`);
  return data.map(d => d.result);
}

export const getJSON = async key => { const v = await cmd('GET', key); return v ? JSON.parse(v) : null; };
export const setJSON = (key, value) => cmd('SET', key, JSON.stringify(value));
export const del = (...keys) => cmd('DEL', ...keys);

export async function hgetall(key) {
  const flat = (await cmd('HGETALL', key)) || [];
  const out = {};
  for (let i = 0; i < flat.length; i += 2) out[flat[i]] = flat[i + 1];
  return out;
}

export const smembers = async key => (await cmd('SMEMBERS', key)) || [];
