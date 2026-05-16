import { SCHEDULE, MEDS, START } from './schedule';

const timers = new Map();

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// Build a Date for a slot's time on its day
function slotDate(dayIndex, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(START);
  d.setDate(d.getDate() + dayIndex);
  d.setHours(h, m, 0, 0);
  return d;
}

function medNames(meds) {
  return meds.map(mk => MEDS[mk].name).join(', ');
}

// Schedule all unchecked, future doses via setTimeout
export function scheduleAll(checked) {
  clearAll();
  const now = Date.now();

  SCHEDULE.forEach((day, d) => {
    day.slots.forEach((slot, s) => {
      if (slot.historic) return;
      if (slot.meds.every(mk => checked[`${d}-${s}-${mk}`])) return;

      const target = slotDate(d, slot.time).getTime();
      const delay = target - now;
      if (delay < 0) return; // past

      const id = setTimeout(() => {
        if (Notification.permission !== 'granted') return;
        new Notification(`Hora do remédio — ${slot.time}`, {
          body: medNames(slot.meds),
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
          tag: `dose-${d}-${s}`,
          renotify: true,
        });
      }, delay);

      timers.set(`${d}-${s}`, id);
    });
  });
}

export function cancelSlot(d, s) {
  const key = `${d}-${s}`;
  if (timers.has(key)) { clearTimeout(timers.get(key)); timers.delete(key); }
}

export function clearAll() {
  timers.forEach(id => clearTimeout(id));
  timers.clear();
}

// ─── .ics export ─────────────────────────────────────────────────────────────
function icsDate(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth()+1)}${pad(date.getDate())}T${pad(date.getHours())}${pad(date.getMinutes())}00`;
}

export function exportICS() {
  const events = [];
  const stamp = icsDate(new Date());

  SCHEDULE.forEach((day, d) => {
    day.slots.forEach((slot, s) => {
      if (slot.historic) return;
      const dt = slotDate(d, slot.time);
      const start = icsDate(dt);
      const end = icsDate(new Date(dt.getTime() + 15 * 60000)); // 15 min duration

      events.push([
        'BEGIN:VEVENT',
        `UID:med-tracker-${d}-${s}@remedios`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${start}`,
        `DTEND:${end}`,
        `SUMMARY:Remédio — ${slot.time}`,
        `DESCRIPTION:${medNames(slot.meds)}`,
        `CATEGORIES:HEALTH`,
        `BEGIN:VALARM`,
        `TRIGGER:-PT5M`,
        `ACTION:DISPLAY`,
        `DESCRIPTION:${medNames(slot.meds)}`,
        `END:VALARM`,
        'END:VEVENT',
      ].join('\r\n'));
    });
  });

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Remédios//Med Tracker//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Remédios — Tratamento',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'remedios-tratamento.ics';
  a.click();
}
