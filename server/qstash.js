import { Client, Receiver } from '@upstash/qstash';

export const qstashBase = () => (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/$/, '');
export const qstash = () => new Client({ token: process.env.QSTASH_TOKEN, baseUrl: qstashBase() });

// Public base URL of the deployment, used as QStash destination.
export function appUrl() {
  const explicit = process.env.APP_URL;
  if (explicit) return explicit.replace(/\/$/, '');
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  throw new Error('APP_URL not configured');
}

// Read the raw request body (needed to verify the QStash signature).
export async function rawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  return Buffer.concat(chunks).toString('utf8');
}

// Verify that a request really came from QStash. Returns the parsed body,
// or null if the signature is missing/invalid.
export async function verifyQStash(req) {
  const signature = req.headers['upstash-signature'];
  if (!signature) return null;
  const body = await rawBody(req);
  const receiver = new Receiver({
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY,
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY,
  });
  try {
    const ok = await receiver.verify({ signature, body });
    if (!ok) return null;
  } catch {
    return null;
  }
  return body ? JSON.parse(body) : {};
}
