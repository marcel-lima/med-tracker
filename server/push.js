import webpush from 'web-push';
import { getJSON, del } from './redis.js';

let configured = false;
function ensureVapid() {
  if (configured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  configured = true;
}

// Send one notification to the stored subscription.
// Returns 'sent' | 'no-subscription' | 'expired'.
export async function sendPush({ title, body, tag, url = '/' }) {
  ensureVapid();
  const subscription = await getJSON('push-sub');
  if (!subscription) return 'no-subscription';
  try {
    await webpush.sendNotification(subscription, JSON.stringify({ title, body, tag, url }));
    return 'sent';
  } catch (e) {
    if (e.statusCode === 410 || e.statusCode === 404) {
      await del('push-sub');
      return 'expired';
    }
    throw e;
  }
}
