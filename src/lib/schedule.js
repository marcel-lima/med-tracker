export const MEDS = {
  amoxil:    { name: 'Amoxil',        dose: '1 cp',         freq: '12/12h',   g1: '#BFE4F8', g2: '#5FB8E8', ink: '#1B5B7E' },
  tylenol:   { name: 'Tylenol Sinus', dose: '2 cp',         freq: '8/8h',     g1: '#EFCFF9', g2: '#C57AE6', ink: '#682A82' },
  predsim:   { name: 'Predsim',       dose: '1 cp',         freq: '1× manhã', g1: '#FED9B7', g2: '#F39A55', ink: '#8C4116' },
  aerolin:   { name: 'Aerolin',       dose: '4 jatos',      freq: '6/6h',     g1: '#C9ECD6', g2: '#7BCFA0', ink: '#1F6B40' },
  rinossoro: { name: 'Rinossoro',     dose: '120ml/narina', freq: '3× dia',   g1: '#FECCD2', g2: '#F08FA0', ink: '#923146' },
};
export const MED_ORDER = ['amoxil', 'tylenol', 'predsim', 'aerolin', 'rinossoro'];
export const START = new Date(2026, 4, 15);
export const TOTAL_DAYS = 11;
export const DOW_I = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

export function buildSched() {
  const days = [];
  for (let i = 0; i < TOTAL_DAYS; i++) {
    const date = addD(START, i);
    const slots = [];
    if (i === 0) {
      slots.push({ time: '18:00', meds: ['aerolin', 'rinossoro'], historic: true });
      slots.push({ time: '23:00', meds: ['amoxil', 'tylenol', 'aerolin'] });
    } else if (i >= 1 && i <= 5) {
      slots.push({ time: '08:00', meds: ['tylenol', 'predsim', 'rinossoro', 'aerolin'] });
      slots.push({ time: '11:00', meds: ['amoxil'] });
      slots.push({ time: '13:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '16:00', meds: ['tylenol'] });
      slots.push({ time: '19:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '23:00', meds: ['amoxil', 'tylenol', 'aerolin'] });
    } else if (i === 6) {
      slots.push({ time: '08:00', meds: ['rinossoro', 'aerolin'] });
      slots.push({ time: '11:00', meds: ['amoxil'] });
      slots.push({ time: '13:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '19:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '23:00', meds: ['amoxil', 'aerolin'] });
    } else if (i === 7) {
      slots.push({ time: '08:00', meds: ['rinossoro', 'aerolin'] });
      slots.push({ time: '11:00', meds: ['amoxil'] });
      slots.push({ time: '13:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '19:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '23:00', meds: ['aerolin'] });
    } else if (i === 8 || i === 9) {
      slots.push({ time: '08:00', meds: ['rinossoro', 'aerolin'] });
      slots.push({ time: '13:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '19:00', meds: ['aerolin', 'rinossoro'] });
      slots.push({ time: '23:00', meds: ['aerolin'] });
    } else {
      slots.push({ time: '08:00', meds: ['aerolin'] });
      slots.push({ time: '13:00', meds: ['aerolin'] });
      slots.push({ time: '19:00', meds: ['aerolin'] });
      slots.push({ time: '23:00', meds: ['aerolin'] });
    }
    days.push({ dayIndex: i, date, slots });
  }
  return days;
}

export const SCHEDULE = buildSched();
