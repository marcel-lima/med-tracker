// Best-effort sync with the server (Vercel functions). The app works fully
// offline; the server only needs the data to send push reminders.

async function call(path, body) {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`${path} → ${r.status}`);
    return await r.json();
  } catch (e) {
    console.warn('[api]', e.message);
    return null;
  }
}

// Replace the treatment on the server and (re)schedule every reminder.
// `reminders` comes from buildReminders(): [{ key, at, title, body, doseKeys }]
export function saveTreatment(treatment, reminders) {
  return call('/api/treatment', { treatment, reminders });
}

// Clear the treatment and cancel every scheduled reminder.
export function clearTreatment() {
  return call('/api/treatment', { treatment: null, reminders: [] });
}

// Tell the server a dose was marked (so it won't nag about it).
export function setChecked(key, value) {
  return call('/api/checked', { key, value });
}

// Push a test notification right now.
export function sendTestPush() {
  return call('/api/test-push', {});
}
