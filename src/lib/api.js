// Best-effort sync with the server (Vercel functions). The app works fully
// offline; the server only needs the data to send push reminders.

async function call(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.warn('[api]', path, r.status, data);
      return { ok: false, status: r.status, error: data.error || `HTTP ${r.status}`, detail: data.detail };
    }
    return data;
  } catch (e) {
    console.warn('[api]', e.message);
    return { ok: false, error: e.message };
  }
}

// Replace the treatment on the server and (re)schedule every reminder.
// `reminders` comes from buildReminders(): [{ key, at, title, body, doseKeys }]
export function saveTreatment(treatment, reminders, checked = []) {
  return call('/api/treatment', { treatment, reminders, checked });
}

// Clear the treatment and cancel every scheduled reminder.
export function clearTreatment() {
  return call('/api/treatment', { treatment: null, reminders: [] });
}

// Tell the server a dose was marked (so it won't nag about it).
export function setChecked(key, value, by = '') {
  return call('/api/checked', { key, value, by });
}

// Push a test notification right now.
export function sendTestPush() {
  return call('/api/test-push', {});
}

// Fetch what the server has (used by a fresh device to restore the treatment).
export async function fetchTreatment() {
  try {
    const r = await fetch('/api/treatment', { cache: 'no-store' });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  }
}

// Schedule a real reminder for ~1 minute from now through QStash.
export function sendScheduledTest() {
  return call('/api/test-schedule', {});
}
