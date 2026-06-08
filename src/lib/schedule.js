export const MEDS = {
  culturelle: { name: 'Culturelle', dose: '1 cp',  freq: '1×/day',  g1: '#C9ECD6', g2: '#7BCFA0', ink: '#1F6B40' },
  buscopan:   { name: 'Buscopan',   dose: '1 cp',  freq: '12/12h',  g1: '#BFE4F8', g2: '#5FB8E8', ink: '#1B5B7E' },
  novalgina:  { name: 'Novalgina',  dose: '1g',    freq: '12/12h',  g1: '#FECCD2', g2: '#F08FA0', ink: '#923146' },
};
export const MED_ORDER = ['culturelle', 'buscopan', 'novalgina'];
export const START = new Date(2026, 5, 8);
export const TOTAL_DAYS = 5;
export const DOW_I = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
export const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function buildSched() {
  const days = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = addD(START, i);
    const slots = [];
    if (i === 0) {
      // Jun 8 — morning dose already taken
      slots.push({ time: '08:00', meds: ['culturelle', 'buscopan', 'novalgina'], historic: true });
      slots.push({ time: '20:00', meds: ['buscopan', 'novalgina'] });
    } else {
      // Jun 9-12 — full days
      slots.push({ time: '08:00', meds: ['culturelle', 'buscopan', 'novalgina'] });
      slots.push({ time: '20:00', meds: ['buscopan', 'novalgina'] });
    }
    days.push({ dayIndex: i, date, slots });
  }
  return days;
}

export const SCHEDULE = buildSched();
