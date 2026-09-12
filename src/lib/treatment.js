// ─── Treatment model ─────────────────────────────────────────────────────────
// treatment = {
//   startDate: 'YYYY-MM-DD',
//   meds: [{ id, name, dose, times: ['08:00', '20:00'], days: 7, color: 'red' }],
//   reminders: { offsetMin: 0, repeatMin: 30 },   // 0 = off
// }
// A "dose" is one med at one date+time. Key: `${date}|${time}|${medId}`.

export const COLORS = {
  red:    { a: '#E5484D', b: '#C9282E', ink: '#7A1A1E', soft: '#FDE5E6' },
  blue:   { a: '#2F80ED', b: '#1C5DBA', ink: '#123A75', soft: '#E1ECFC' },
  yellow: { a: '#F5C518', b: '#D9A600', ink: '#6B5200', soft: '#FFF5CC' },
  orange: { a: '#F5822B', b: '#D66512', ink: '#6E3408', soft: '#FFE8D6' },
  green:  { a: '#3DBF7A', b: '#2A9A5F', ink: '#155C36', soft: '#DFF5E8' },
  purple: { a: '#9B6BE0', b: '#7A4BC4', ink: '#41256E', soft: '#EEE4FB' },
};
export const COLOR_ORDER = ['red', 'blue', 'yellow', 'orange', 'green', 'purple'];

export const FREQ_PRESETS = [
  { label: '1× ao dia', times: ['08:00'] },
  { label: '12/12h',    times: ['08:00', '20:00'] },
  { label: '8/8h',      times: ['06:00', '14:00', '22:00'] },
  { label: '6/6h',      times: ['06:00', '12:00', '18:00', '00:00'] },
];

export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = n => String(n).padStart(2, '0');
export const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISODate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISODate(new Date());
export const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const uid = () => Math.random().toString(36).slice(2, 9);

export function newMed(index = 0) {
  return {
    id: uid(),
    name: '',
    dose: '',
    times: ['08:00', '20:00'],
    days: 7,
    color: COLOR_ORDER[index % COLOR_ORDER.length],
  };
}

export function emptyTreatment() {
  return {
    startDate: todayISO(),
    meds: [],
    reminders: { offsetMin: 0, repeatMin: 30 },
  };
}

export function isActive(t) {
  return !!t && Array.isArray(t.meds) && t.meds.length > 0;
}

export function totalDays(t) {
  if (!isActive(t)) return 0;
  return Math.max(...t.meds.map(m => Number(m.days) || 1));
}

export function doseKey(date, time, medId) { return `${date}|${time}|${medId}`; }
export function slotKey(date, time) { return `${date}|${time}`; }

// Absolute time of a dose, in the device's timezone.
export function doseDate(date, time) {
  const d = fromISODate(date);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}

// Every dose of the treatment, in chronological order.
export function buildDoses(t) {
  if (!isActive(t)) return [];
  const start = fromISODate(t.startDate);
  const out = [];
  t.meds.forEach(med => {
    const days = Math.max(1, Number(med.days) || 1);
    for (let i = 0; i < days; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const date = toISODate(d);
      [...med.times].sort((a, b) => t2m(a) - t2m(b)).forEach(time => {
        out.push({ key: doseKey(date, time, med.id), date, time, medId: med.id, at: doseDate(date, time) });
      });
    }
  });
  out.sort((a, b) => a.at - b.at || a.medId.localeCompare(b.medId));
  return out;
}

// Days of the treatment: [{ date, dateObj, slots: [{ time, doses: [...] }] }]
export function buildDays(t) {
  const doses = buildDoses(t);
  const byDate = new Map();
  doses.forEach(dose => {
    if (!byDate.has(dose.date)) byDate.set(dose.date, new Map());
    const slots = byDate.get(dose.date);
    if (!slots.has(dose.time)) slots.set(dose.time, []);
    slots.get(dose.time).push(dose);
  });
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, slots]) => ({
      date,
      dateObj: fromISODate(date),
      slots: [...slots.entries()]
        .sort(([a], [b]) => t2m(a) - t2m(b))
        .map(([time, doses]) => ({ time, key: slotKey(date, time), doses })),
    }));
}

export function medById(t, id) {
  return t?.meds?.find(m => m.id === id) || null;
}

export function medsForSlot(t, slot) {
  return slot.doses.map(d => medById(t, d.medId)).filter(Boolean);
}

// Next slot that still has an unchecked dose. Grace: a slot counts as
// "next" until 60 min after its time, then we move on.
export function findNextSlot(days, checked, now = new Date()) {
  const cutoff = now.getTime() - 60 * 60000;
  for (const day of days) {
    for (const slot of day.slots) {
      if (slot.doses.every(d => checked[d.key])) continue;
      if (slot.doses[0].at.getTime() < cutoff) continue;
      return { day, slot };
    }
  }
  return null;
}

export function dayProgress(day, checked) {
  let total = 0, done = 0;
  day.slots.forEach(s => s.doses.forEach(d => { total++; if (checked[d.key]) done++; }));
  return { total, done };
}

export function formatDate(d) {
  return `${DOW[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

// Reminder instants for the server: one (or two) per slot.
// Returns [{ key, at (epoch ms), title, body, doseKeys }]
export function buildReminders(t) {
  if (!isActive(t)) return [];
  const { offsetMin = 0, repeatMin = 0 } = t.reminders || {};
  const days = buildDays(t);
  const out = [];
  days.forEach(day => day.slots.forEach(slot => {
    const names = medsForSlot(t, slot).map(m => m.name).join(', ');
    const base = slot.doses[0].at.getTime() + offsetMin * 60000;
    const doseKeys = slot.doses.map(d => d.key);
    out.push({ key: `${slot.key}|1`, at: base, title: `Hora do remédio · ${slot.time}`, body: names, doseKeys });
    if (repeatMin > 0) {
      out.push({ key: `${slot.key}|2`, at: base + repeatMin * 60000, title: `Ainda não tomou? · ${slot.time}`, body: names, doseKeys });
    }
  }));
  return out;
}

// Validation for the editor. Returns array of error strings.
export function validate(t) {
  const errs = [];
  if (!t.startDate) errs.push('Escolha a data de início.');
  if (!t.meds.length) errs.push('Adicione pelo menos um remédio.');
  t.meds.forEach((m, i) => {
    if (!m.name.trim()) errs.push(`Remédio ${i + 1}: falta o nome.`);
    if (!m.times.length) errs.push(`${m.name || `Remédio ${i + 1}`}: escolha pelo menos um horário.`);
    if (!(Number(m.days) >= 1)) errs.push(`${m.name || `Remédio ${i + 1}`}: duração precisa ser 1 dia ou mais.`);
  });
  return errs;
}
