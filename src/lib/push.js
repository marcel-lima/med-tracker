const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

export function isInstalledPWA() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

export async function getPushPermission() {
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

export async function subscribePush() {
  const reg = await navigator.serviceWorker.ready;

  // Reuse existing subscription if valid
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Re-POST to server in case it was lost
    await postSubscription(sub.toJSON());
    return sub;
  }

  sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });

  await postSubscription(sub.toJSON());
  return sub;
}

export async function unsubscribePush() {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  try {
    await fetch('/api/subscribe', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint }),
    });
  } catch { /* best effort */ }
}

async function postSubscription(sub) {
  const r = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sub),
  });
  if (!r.ok) {
    const data = await r.json().catch(() => ({}));
    throw new Error(`Não consegui registrar este aparelho no servidor (${data.error || r.status}).`);
  }
}

// If this device already has a push subscription, make sure the server knows it.
// Cheap and idempotent; called whenever the app opens.
export async function ensureRegistered() {
  try {
    if (!isPushSupported() || Notification.permission !== 'granted') return null;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return null;
    await postSubscription(sub.toJSON());
    return sub.endpoint;
  } catch (e) {
    console.warn('[push] ensureRegistered:', e.message);
    return null;
  }
}

// Ask the server whether this device is registered and how many devices exist.
export async function registrationStatus() {
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    const q = sub ? `?endpoint=${encodeURIComponent(sub.endpoint)}` : '';
    const r = await fetch(`/api/subscribe${q}`, { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json(); // { devices, registered }
  } catch {
    return null;
  }
}
