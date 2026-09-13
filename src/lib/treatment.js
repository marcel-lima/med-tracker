// ─── Treatment model ─────────────────────────────────────────────────────────
// treatment = {
//   startDate: 'YYYY-MM-DD',
//   feedings: ['08:00', '20:00'],                 // meal times (optional)
//   meds: [{ id, name, dose, times: ['08:00', '20:00'], days: 7, color: 'red',
//            food: 'none' | 'before' | 'with' | 'after', foodMin: 30,
//            foodTimes: ['08:00'] }],   // which meals apply; [] = all
//   reminders: { offsetMin: 0, repeatMin: 30 },   // 0 = off
// }
// When med.food !== 'none', med.times are derived from feedings (± foodMin).
// Meals show up as a virtual "med" (FEED_ID) so they get a slot, a check and a reminder.
// med.days === 0 means continuous ("sempre"): doses are generated up to
// HORIZON_DAYS ahead of today and the app re-syncs the server daily.
// A "dose" is one med at one date+time. Key: `${date}|${time}|${medId}`.

export const COLORS = {
  red:    { a: '#E5484D', b: '#C9282E', ink: '#7A1A1E', soft: '#FDE5E6' },
  blue:   { a: '#2F80ED', b: '#1C5DBA', ink: '#123A75', soft: '#E1ECFC' },
  yellow: { a: '#F5C518', b: '#D9A600', ink: '#6B5200', soft: '#FFF5CC' },
  orange: { a: '#F5822B', b: '#D66512', ink: '#6E3408', soft: '#FFE8D6' },
  green:  { a: '#3DBF7A', b: '#2A9A5F', ink: '#155C36', soft: '#DFF5E8' },
  purple: { a: '#9B6BE0', b: '#7A4BC4', ink: '#41256E', soft: '#EEE4FB' },
  feed:   { a: '#C9A27E', b: '#A8825F', ink: '#5A3E22', soft: '#F3E8DB' },
};
export const FEED_ID = '__feed';
export const FEED_NAME = 'Ração';
export const FOOD_OPTIONS = [
  { value: 'none',   label: 'não depende' },
  { value: 'before', label: 'antes' },
  { value: 'with',   label: 'junto' },
  { value: 'after',  label: 'depois' },
];
export const COLOR_ORDER = ['red', 'blue', 'yellow', 'orange', 'green', 'purple'];

// Frequency is a rule: an interval in hours from the first dose.
// 'custom' means a free list of times.
export const FREQ_PRESETS = [
  { label: '1× ao dia', hours: 24 },
  { label: '12/12h',    hours: 12 },
  { label: '8/8h',      hours: 8 },
  { label: '6/6h',      hours: 6 },
];

export const HORIZON_DAYS = 60;
export const DOW = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const pad = n => String(n).padStart(2, '0');
export const toISODate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISODate = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISODate(new Date());
export const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const uid = () => Math.random().toString(36).slice(2, 9);
export const m2t = m => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

// Times for a first dose repeated every `hours` (24 → once a day).
export function deriveTimes(first, hours) {
  const count = Math.max(1, Math.round(24 / hours));
  const out = [];
  for (let k = 0; k < count; k++) out.push(m2t(t2m(first) + k * hours * 60));
  return [...new Set(out)].sort((a, b) => t2m(a) - t2m(b));
}

// Guess the interval behind an existing time list (or 'custom').
export function inferFreq(times) {
  for (const p of FREQ_PRESETS) {
    if (times.length && deriveTimes(times[0], p.hours).join() === [...times].sort((a, b) => t2m(a) - t2m(b)).join()) return p.hours;
  }
  return 'custom';
}

// Meals a med is tied to: its chosen subset, or every meal when none chosen.
export function mealsFor(med, feedings = []) {
  const chosen = (med.foodTimes || []).filter(f => feedings.includes(f));
  return chosen.length ? chosen : [...feedings];
}

export function mealLabel(time) {
  const h = t2m(time) / 60;
  return h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite';
}

// Times a med is actually given: its own, or derived from the meal times.
export function effectiveTimes(med, feedings = []) {
  if (!med.food || med.food === 'none' || !feedings.length) return [...med.times];
  const shift = med.food === 'before' ? -(Number(med.foodMin) || 0) : med.food === 'after' ? (Number(med.foodMin) || 0) : 0;
  return [...new Set(mealsFor(med, feedings).map(f => m2t(t2m(f) + shift)))].sort((a, b) => t2m(a) - t2m(b));
}

export function foodNote(med, feedings = []) {
  if (!med.food || med.food === 'none') return null;
  const meals = mealsFor(med, feedings);
  const which = feedings.length > 1 && meals.length < feedings.length
    ? ` da ${meals.map(mealLabel).join(' e ')}`
    : '';
  if (med.food === 'with') return `junto com a ração${which}`;
  return `${med.foodMin} min ${med.food === 'before' ? 'antes' : 'depois'} da ração${which}`;
}

// Real meds + the virtual meal "med", all with effective times.
export function allMeds(t) {
  if (!isActive(t)) return [];
  const feedings = t.feedings || [];
  const meds = t.meds.map(m => ({ ...m, times: effectiveTimes(m, feedings) }));
  if (feedings.length) {
    const td = totalDays(t);
    meds.push({ id: FEED_ID, name: FEED_NAME, dose: '', times: [...feedings].sort((a, b) => t2m(a) - t2m(b)), days: td === Infinity ? 0 : td, color: 'feed', food: 'none', foodMin: 0 });
  }
  return meds;
}

export function newMed(index = 0) {
  return {
    id: uid(),
    name: '',
    dose: '',
    freq: 12,               // hours between doses, or 'custom'
    times: ['08:00', '20:00'],
    days: 7,
    color: COLOR_ORDER[index % COLOR_ORDER.length],
    food: 'none',
    foodMin: 30,
    foodTimes: [],
  };
}

export function emptyTreatment() {
  return {
    pet: '',
    startDate: todayISO(),
    feedings: [],
    meds: [],
    reminders: { offsetMin: 0, repeatMin: 30 },
  };
}

export function isActive(t) {
  return !!t && Array.isArray(t.meds) && t.meds.length > 0;
}

export const isForever = med => Number(med.days) === 0;

// Longest med duration in days; Infinity when any med is continuous.
export function totalDays(t) {
  if (!isActive(t)) return 0;
  if (t.meds.some(isForever)) return Infinity;
  return Math.max(...t.meds.map(m => Number(m.days) || 1));
}

// Number of days to generate for a med: its own, or up to the horizon.
function spanDays(med, start) {
  if (!isForever(med)) return Math.max(1, Number(med.days) || 1);
  const end = new Date(); end.setDate(end.getDate() + HORIZON_DAYS);
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
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
  allMeds(t).forEach(med => {
    const days = spanDays(med, start);
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
  if (id === FEED_ID) return allMeds(t).find(m => m.id === FEED_ID) || null;
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
    const meds = medsForSlot(t, slot);
    const names = meds.map(m => m.name).join(', ');
    const mealOnly = meds.length > 0 && meds.every(m => m.id === FEED_ID);
    const what = mealOnly ? 'Hora da ração' : 'Hora do remédio';
    const base = slot.doses[0].at.getTime() + offsetMin * 60000;
    const doseKeys = slot.doses.map(d => d.key);
    out.push({ key: `${slot.key}|1`, at: base, title: `${what} · ${slot.time}`, body: names, doseKeys });
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
    const relative = m.food && m.food !== 'none';
    if (relative && !(t.feedings || []).length) errs.push(`${m.name || `Remédio ${i + 1}`}: defina os horários da ração para usar "${m.food === 'with' ? 'junto' : m.food === 'before' ? 'antes' : 'depois'}".`);
    if (!relative && !m.times.length) errs.push(`${m.name || `Remédio ${i + 1}`}: escolha pelo menos um horário.`);
    if (!(Number(m.days) >= 0)) errs.push(`${m.name || `Remédio ${i + 1}`}: duração precisa ser 1 dia ou mais, ou "sempre".`);
  });
  return errs;
}
