export const MEDS = {
  seki:    { name: 'Seki Xarope', dose: '10ml',  freq: '8/8h',    g1: '#FED9B7', g2: '#F39A55', ink: '#8C4116' },
  levoxin: { name: 'Levoxin',     dose: '1 cp',  freq: '1×/day',  g1: '#BFE4F8', g2: '#5FB8E8', ink: '#1B5B7E' },
  flancox: { name: 'Flancox',     dose: '1 cp',  freq: '12/12h',  g1: '#EFCFF9', g2: '#C57AE6', ink: '#682A82' },
};
export const MED_ORDER = ['seki', 'levoxin', 'flancox'];
export const START = new Date(2026, 4, 25);
export const TOTAL_DAYS = 7;
export const DOW_I = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function buildSched() {
  const days = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = addD(START, i);
    const slots = [];
    if (i === 0) {
      // May 19 — started today; morning/afternoon already taken
      slots.push({ time: '08:00', meds: ['flancox'], historic: true });
      slots.push({ time: '12:00', meds: ['seki', 'levoxin'], historic: true });
      slots.push({ time: '20:00', meds: ['flancox'], historic: true });
      slots.push({ time: '23:00', meds: ['seki'] });
    } else if (i >= 1 && i <= 4) {
      // May 20-23 — full days (Seki + Levoxin + Flancox)
      slots.push({ time: '08:00', meds: ['seki', 'flancox'] });
      slots.push({ time: '13:00', meds: ['seki', 'levoxin'] });
      slots.push({ time: '20:00', meds: ['flancox'] });
      slots.push({ time: '23:00', meds: ['seki'] });
    } else {
      // May 24-25 — only Levoxin remains (7 days)
      slots.push({ time: '13:00', meds: ['levoxin'] });
    }
    days.push({ dayIndex: i, date, slots });
  }
  return days;
}

export const SCHEDULE = buildSched();
