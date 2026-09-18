import { useMemo } from 'react';
import { COLORS, COLOR_ORDER, t2m } from '../lib/treatment';

const C = 150;       // center
const R = 118;       // ring radius
const N = 24;        // capsules (2 per hour)

// hour:minute → capsule index (12h face, half-hour resolution)
const timeToIndex = (time) => Math.round((t2m(time) % 720) / 30) % N;

/**
 * Ring of 24 capsules forming a clock face. Capsules at scheduled hours take
 * the color of the meds scheduled there; hands point to the next dose.
 *
 * props:
 *  meds       — treatment meds [{ id, color, times }]
 *  today      — today's day object ({ slots: [{ time, doses }] }) or null
 *  checked    — { doseKey: true }
 *  target     — 'HH:MM' the hands point to (next dose), or null → current time
 *  now        — Date
 *  dark       — bool
 *  intro      — bool, play entrance animation
 */
export default function PillClock({ meds = [], today = null, checked = {}, target = null, now = new Date(), dark = false, intro = true }) {
  const capsules = useMemo(() => {
    const slots = Array.from({ length: N }, () => ({ colors: [], done: false }));
    meds.forEach(med => med.times.forEach(time => {
      const i = timeToIndex(time);
      if (!slots[i].colors.includes(med.color)) slots[i].colors.push(med.color);
    }));
    if (today) {
      today.slots.forEach(slot => {
        if (slot.doses.every(d => checked[d.key])) slots[timeToIndex(slot.time)].done = true;
      });
    }
    return slots;
  }, [meds, today, checked]);

  const empty = meds.length === 0;
  const grey = dark ? '#2C2C31' : '#DCE0EC';
  const hand = dark ? '#F4F4F5' : '#1C2451';
  const minuteHand = dark ? '#F5B942' : '#F0655A'; // accent, like a watch face's second hand

  // Hands
  const tm = target ? t2m(target) : now.getHours() * 60 + now.getMinutes();
  const h = Math.floor(tm / 60) % 12, m = tm % 60;
  const hourAngle = h * 30 + m * 0.5;
  const minuteAngle = m * 6;

  return (
    <svg viewBox="0 0 300 300" className="pill-clock" role="img" aria-label={target ? `Próxima dose às ${target}` : 'Relógio'}>
      {capsules.map((cap, i) => {
        const angle = i * 15;
        let fillA, fillB;
        if (cap.colors.length === 0) {
          if (empty) {
            const c = COLORS[COLOR_ORDER[i % COLOR_ORDER.length]];
            fillA = fillB = c.a;
          } else {
            fillA = fillB = grey;
          }
        } else {
          fillA = COLORS[cap.colors[0]].a;
          fillB = COLORS[cap.colors[1] || cap.colors[0]].b;
          if (cap.colors.length === 1) fillB = COLORS[cap.colors[0]].a;
        }
        const opacity = empty ? 0.28 : cap.done ? 0.3 : 1;
        return (
          <g key={i} transform={`rotate(${angle} ${C} ${C}) translate(${C} ${C - R})`}
             style={{ opacity, transition: 'opacity .4s' }}>
            {/* inner group carries the CSS entrance animation so it never
                fights the positioning transform attribute above */}
            <g className={intro ? 'cap-enter' : undefined} style={{ animationDelay: `${i * 22}ms` }}>
              {/* full capsule */}
              <rect x="-7" y="-17" width="14" height="34" rx="7" fill={fillA} />
              {/* outer half */}
              <path d="M -7 0 L -7 -10 A 7 7 0 0 1 7 -10 L 7 0 Z" fill={fillB} />
              {/* seam */}
              <rect x="-7" y="-0.5" width="14" height="1" fill="rgba(0,0,0,0.14)" />
              {/* gloss */}
              <rect x="-4.5" y="-13" width="2" height="26" rx="1" fill="rgba(255,255,255,0.35)" />
            </g>
          </g>
        );
      })}

      {/* hands */}
      <g className={intro ? 'hands-enter' : undefined}>
        <line x1={C} y1={C + 8} x2={C} y2={C - 62} stroke={hand} strokeWidth="6" strokeLinecap="round"
              transform={`rotate(${hourAngle} ${C} ${C})`} style={{ transition: 'transform .8s cubic-bezier(.2,.8,.2,1)' }} />
        <line x1={C} y1={C + 10} x2={C} y2={C - 92} stroke={minuteHand} strokeWidth="4" strokeLinecap="round"
              transform={`rotate(${minuteAngle} ${C} ${C})`} style={{ transition: 'transform .8s cubic-bezier(.2,.8,.2,1)' }} />
        <circle cx={C} cy={C} r="6" fill={hand} />
        <circle cx={C} cy={C} r="2" fill={dark ? '#0B0B0D' : '#F2F3F7'} />
      </g>
    </svg>
  );
}
