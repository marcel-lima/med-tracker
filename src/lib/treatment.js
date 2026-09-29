// ─── Treatment model ─────────────────────────────────────────────────────────
// treatment = {
//   startDate: 'YYYY-MM-DD',
//   pets: [{ id, name, sex: 'f' | 'm', feedings: ['08:00', '20:00'] }], // meal times per pet (optional)
//   meds: [{ id, petId, name, dose, times: ['08:00', '20:00'], days: 7, color: 'red',
//            food: 'none' | 'before' | 'with' | 'after', foodMin: 30,
//            foodTimes: ['08:00'],      // which meals apply; [] = all
//            startDate: 'YYYY-MM-DD',    // optional: this med began later than the treatment
//            startTime: 'HH:MM' }],      // optional: first dose of the start day (skips earlier slots;
//                                         //   days × doses/day still holds, so the course runs into an extra day)
//   reminders: { offsetMin: 0, repeatMin: 30 },   // 0 = off
// }
// When med.food !== 'none', med.times are derived from the pet's feedings (± foodMin).
// Each pet's meals show up as a virtual "med" (feedId(pet)) so they get a slot, a check and a reminder.
// Older treatments had a single `pet` name and `feedings` list; petsOf() reads both shapes.
// med.days === 0 means continuous ("sempre"): doses are generated up to
// HORIZON_DAYS ahead of today and the app re-syncs the server daily.
// A "dose" is one med at one date+time. Key: `${date}|${time}|${medId}`.

export const COLORS = {
  red:    { a: '#F0655A', b: '#D14A40', ink: '#7A2A24', soft: '#FDE4E1' },
  blue:   { a: '#3A5BE8', b: '#2743B8', ink: '#182C7A', soft: '#E2E8FC' },
  yellow: { a: '#F5B800', b: '#D69C00', ink: '#6B4F00', soft: '#FFF3C4' },
  orange: { a: '#F58B3C', b: '#D66E1F', ink: '#6E3608', soft: '#FFE9D6' },
  green:  { a: '#34C38F', b: '#249C70', ink: '#155C40', soft: '#DDF6EC' },
  purple: { a: '#8A6CF6', b: '#6A4BD6', ink: '#3B2680', soft: '#ECE6FD' },
  feed:   { a: '#C9A27E', b: '#A8825F', ink: '#5A3E22', soft: '#F3E8DB' },
};
export const FEED_ID = '__feed';
export const FEED_NAME = 'Ração';
export const MAIN_PET = 'main'; // id given to the pet migrated from the single-pet shape
export const isFeed = id => typeof id === 'string' && id.startsWith(FEED_ID);
// The first (migrated) pet keeps the bare FEED_ID so doses already marked stay valid.
export const feedId = petId => (petId === MAIN_PET ? FEED_ID : `${FEED_ID}:${petId}`);
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
  return (chosen.length ? chosen : [...feedings]).sort((a, b) => t2m(a) - t2m(b));
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

// Pets of a treatment, tolerating the old single-pet shape.
export function petsOf(t) {
  if (Array.isArray(t?.pets) && t.pets.length) return t.pets;
  return [{ id: MAIN_PET, name: t?.pet || '', sex: 'f', feedings: t?.feedings || [] }];
}
export const petById = (t, id) => petsOf(t).find(p => p.id === id) || petsOf(t)[0];
export const petOfMed = (t, med) => petById(t, med.petId || MAIN_PET);
export const feedingsFor = (t, med) => petOfMed(t, med).feedings || [];

// Canonical shape: pets array, every med with a petId, no legacy fields.
export function normalize(t) {
  if (!t) return t;
  const pets = petsOf(t).map(p => ({ sex: 'f', feedings: [], ...p }));
  const meds = (t.meds || []).map(m => ({ ...m, petId: pets.some(p => p.id === m.petId) ? m.petId : pets[0].id }));
  const { pet: _pet, feedings: _feedings, ...rest } = t; // eslint-disable-line no-unused-vars
  return { ...rest, pets, meds };
}

// "da Kika", "do Bolt", "da Kika e do Bolt" — for the title.
export function petsTitle(pets) {
  const named = pets.filter(p => p.name);
  return named.map(p => ({ article: p.sex === 'm' ? 'do' : 'da', name: p.name }));
}

// First day a med is given: its own start when set, else the treatment's.
export const medStart = (t, med) => med.startDate || t.startDate;

// Earliest start across meds (the treatment's own start, or earlier if a med says so).
// With petId, only that pet's meds count.
export function firstDay(t, petId = null) {
  const meds = medsOfPet(t, petId);
  if (!meds.length) return t?.startDate;
  return meds.reduce((min, m) => (medStart(t, m) < min ? medStart(t, m) : min), medStart(t, meds[0]));
}

const medsOfPet = (t, petId) => (t?.meds || []).filter(m => petId === null || (m.petId || MAIN_PET) === petId);

const daysBetween = (a, b) => Math.round((fromISODate(b) - fromISODate(a)) / 86400000);

// Real meds + one virtual meal "med" per pet, all with effective times and
// start dates. A pet's meals run from its earliest med start to its latest end.
export function allMeds(t) {
  if (!isActive(t)) return [];
  const meds = t.meds.map(m => ({ ...m, petId: m.petId || MAIN_PET, startDate: medStart(t, m), times: effectiveTimes(m, feedingsFor(t, m)) }));
  petsOf(t).forEach(pet => {
    const feedings = pet.feedings || [];
    if (!feedings.length || !medsOfPet(t, pet.id).length) return;
    const td = totalDays(t, pet.id);
    meds.push({ id: feedId(pet.id), petId: pet.id, name: FEED_NAME, dose: '', startDate: firstDay(t, pet.id),
                times: [...feedings].sort((a, b) => t2m(a) - t2m(b)), days: td === Infinity ? 0 : td, color: 'feed', food: 'none', foodMin: 0 });
  });
  return meds;
}

export function newMed(index = 0, petId = MAIN_PET) {
  return {
    id: uid(),
    petId,
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

export function newPet() {
  return { id: uid(), name: '', sex: 'f', feedings: [] };
}

export function emptyTreatment() {
  return {
    startDate: todayISO(),
    pets: [{ id: MAIN_PET, name: '', sex: 'f', feedings: [] }],
    meds: [],
    reminders: { offsetMin: 0, repeatMin: 30 },
  };
}

export function isActive(t) {
  return !!t && Array.isArray(t.meds) && t.meds.length > 0;
}

export const isForever = med => Number(med.days) === 0;

// Whole span in days, from the earliest med start to the latest med end;
// Infinity when any med is continuous. With petId, only that pet's meds.
export function totalDays(t, petId = null) {
  const meds = medsOfPet(t, petId);
  if (!meds.length) return 0;
  if (meds.some(isForever)) return Infinity;
  const first = firstDay(t, petId);
  return Math.max(...meds.map(m => daysBetween(first, medStart(t, m)) + medSpanDays(m)));
}

// How many of the day's slots are skipped on the start day (first dose later in the day).
function skippedOnFirstDay(med) {
  if (!med.startTime) return 0;
  const times = [...med.times].sort((a, b) => t2m(a) - t2m(b));
  const i = times.indexOf(med.startTime);
  return i > 0 ? i : 0;
}

// Calendar days a med occupies: its own count, plus one when the first day
// is partial (the skipped doses are made up at the end).
export function medSpanDays(med) {
  if (isForever(med)) return Infinity;
  return Math.max(1, Number(med.days) || 1) + (skippedOnFirstDay(med) > 0 ? 1 : 0);
}

// Number of days to generate for a med: its own, or up to the horizon.
function spanDays(med, start) {
  if (!isForever(med)) return medSpanDays(med);
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
  const out = [];
  allMeds(t).forEach(med => {
    const start = fromISODate(med.startDate);
    const days = spanDays(med, start);
    const times = [...med.times].sort((a, b) => t2m(a) - t2m(b));
    const skip = skippedOnFirstDay(med);
    // Total doses of the course: days × doses per day (unbounded when continuous)
    const total = isForever(med) ? Infinity : Math.max(1, Number(med.days) || 1) * times.length;
    let count = 0;
    for (let i = 0; i < days && count < total; i++) {
      const d = new Date(start); d.setDate(d.getDate() + i);
      const date = toISODate(d);
      times.forEach((time, j) => {
        if (i === 0 && j < skip) return;
        if (count >= total) return;
        count++;
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
  if (isFeed(id)) return allMeds(t).find(m => m.id === id) || null;
  const m = t?.meds?.find(m => m.id === id);
  return m ? { ...m, petId: m.petId || MAIN_PET } : null;
}

// Treatment restricted to one pet (null = everyone), for the filtered home view.
export function forPet(t, petId) {
  if (!petId || !isActive(t)) return t;
  return { ...t, meds: t.meds.filter(m => (m.petId || MAIN_PET) === petId) };
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
    const multi = petsOf(t).length > 1;
    const names = meds.map(m => (multi ? `${petOfMed(t, m).name || 'pet'}: ${m.name}` : m.name)).join(', ');
    const mealOnly = meds.length > 0 && meds.every(m => isFeed(m.id));
    const what = mealOnly ? 'Hora da ração' : 'Hora do remédio';
    const base = slot.doses[0].at.getTime() + offsetMin * 60000;
    const doseKeys = slot.doses.map(d => d.key);
    out.push({ key: `${slot.key}|1`, at: base, title: `${what} · ${slot.time}`, body: names, doseKeys });
    if (repeatMin > 0) {
      out.push({ key: `${slot.key}|2`, at: base + repeatMin * 60000, title: `Ainda não deu? · ${slot.time}`, body: names, doseKeys });
    }
  }));
  return out;
}

// Validation for the editor. Returns array of error strings.
export function validate(t) {
  const errs = [];
  if (!t.startDate) errs.push('Escolha a data de início.');
  t.meds.forEach((m, i) => {
    if (m.startDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.startDate)) errs.push(`${m.name || `Remédio ${i + 1}`}: data de início inválida.`);
  });
  if (!t.meds.length) errs.push('Adicione pelo menos um remédio.');
  const pets = petsOf(t);
  if (pets.length > 1) pets.forEach((p, i) => { if (!(p.name || '').trim()) errs.push(`Pet ${i + 1}: falta o nome.`); });
  t.meds.forEach((m, i) => {
    if (!m.name.trim()) errs.push(`Remédio ${i + 1}: falta o nome.`);
    const relative = m.food && m.food !== 'none';
    if (relative && !feedingsFor(t, m).length) errs.push(`${m.name || `Remédio ${i + 1}`}: defina os horários da ração${pets.length > 1 ? ` de ${petOfMed(t, m).name || 'cada pet'}` : ''} para usar "${m.food === 'with' ? 'junto' : m.food === 'before' ? 'antes' : 'depois'}".`);
    if (!relative && !m.times.length) errs.push(`${m.name || `Remédio ${i + 1}`}: escolha pelo menos um horário.`);
    if (!(Number(m.days) >= 0)) errs.push(`${m.name || `Remédio ${i + 1}`}: duração precisa ser 1 dia ou mais, ou "sempre".`);
  });
  return errs;
}
