import { useState } from 'react';
import { X } from 'lucide-react';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 30, 40, 45, 50];
const pad = n => String(n).padStart(2, '0');

/**
 * Bottom-sheet time picker that behaves the same on desktop and phone:
 * a grid of hours, a row of minutes, and a field for typing "HH:MM".
 */
export default function TimePicker({ value, title = 'Horário', onChange, onClose }) {
  const [h0, m0] = (value || '08:00').split(':').map(Number);
  const [h, setH] = useState(h0);
  const [m, setM] = useState(m0);
  const [typed, setTyped] = useState('');

  const commit = (hh, mm) => { onChange(`${pad(hh)}:${pad(mm)}`); onClose(); };

  const onTyped = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    setTyped(digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits);
    if (digits.length === 4) {
      const hh = Number(digits.slice(0, 2)), mm = Number(digits.slice(2));
      if (hh < 24 && mm < 60) { setH(hh); setM(mm); }
    }
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="bottom-sheet max-w-lg mx-auto">
        <div className="w-10 h-1 rounded-full mx-auto mb-4" style={{ background: 'var(--line)' }} />
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="eyebrow">{title}</p>
            <div className="text-4xl font-semibold tabular-nums tracking-tight leading-none mt-1">{pad(h)}:{pad(m)}</div>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fechar"><X size={14} /></button>
        </div>

        <input
          id="time-typed"
          className="input w-full mb-4 tabular-nums"
          inputMode="numeric"
          placeholder="ou digite, ex: 0730"
          value={typed}
          onChange={e => onTyped(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(h, m); }}
        />

        <p className="eyebrow mb-2">hora</p>
        <div className="grid grid-cols-6 gap-1.5 mb-4">
          {HOURS.map(x => (
            <button key={x} onClick={() => setH(x)}
                    className={`chip justify-center tabular-nums ${x === h ? 'chip-on' : ''}`}>{pad(x)}</button>
          ))}
        </div>

        <p className="eyebrow mb-2">minutos</p>
        <div className="flex flex-wrap gap-1.5 mb-6">
          {MINUTES.map(x => (
            <button key={x} onClick={() => setM(x)}
                    className={`chip tabular-nums ${x === m ? 'chip-on' : ''}`}>{pad(x)}</button>
          ))}
        </div>

        <button onClick={() => commit(h, m)} className="btn btn-primary w-full">Usar {pad(h)}:{pad(m)}</button>
      </div>
    </>
  );
}
