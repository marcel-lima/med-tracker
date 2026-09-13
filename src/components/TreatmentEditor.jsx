import { useState } from 'react';
import { X, Plus, Trash2, PawPrint } from 'lucide-react';
import { COLORS, COLOR_ORDER, FREQ_PRESETS, FOOD_OPTIONS, newMed, validate, t2m, effectiveTimes, deriveTimes, inferFreq, mealsFor, mealLabel } from '../lib/treatment';
import TimePicker from './TimePicker';

const DAY_PRESETS = [3, 5, 7, 10, 14, 30, 45, 60];
const QTY_PRESETS = ['½', '1', '1½', '2'];
const UNITS = ['cp', 'ml', 'mg', 'gotas', 'cáps', 'sachê'];

// "1 cp" ⇄ { qty: '1', unit: 'cp' }
function parseDose(dose = '') {
  const m = dose.trim().match(/^(\S+)\s+(.+)$/);
  if (m) return { qty: m[1], unit: m[2] };
  return { qty: dose.trim(), unit: '' };
}
const joinDose = (qty, unit) => `${qty.trim()} ${unit.trim()}`.trim();


export default function TreatmentEditor({ initial, onSave, onCancel, onEnd, startWithNew = false }) {
  const [t, setT] = useState(() => {
    const meds = initial.meds.map(m => ({ ...newMed(0), ...m, times: [...m.times], freq: m.freq ?? inferFreq(m.times) }));
    if (!meds.length) meds.push(newMed(0));
    else if (startWithNew) {
      const used = meds.map(m => m.color);
      const color = COLOR_ORDER.find(c => !used.includes(c)) || COLOR_ORDER[meds.length % COLOR_ORDER.length];
      meds.push({ ...newMed(meds.length), color });
    }
    return { ...initial, feedings: [...(initial.feedings || [])], meds };
  });
  const [errors, setErrors] = useState([]);
  // { kind: 'feed' | 'med', medId?, index, value } while a time is being edited
  const [picking, setPicking] = useState(null);
  const [colorOpen, setColorOpen] = useState(null); // med id with the color row open
  const isNew = initial.meds.length === 0;

  const applyPick = (value) => {
    if (!picking) return;
    if (picking.kind === 'feed') {
      setT(prev => {
        const feedings = [...prev.feedings];
        if (picking.index === -1) feedings.push(value); else feedings[picking.index] = value;
        return { ...prev, feedings: [...new Set(feedings)] };
      });
    } else {
      setT(prev => ({ ...prev, meds: prev.meds.map(m => {
        if (m.id !== picking.medId) return m;
        if (m.freq !== 'custom') return { ...m, times: deriveTimes(value, m.freq) };
        const times = [...m.times];
        if (picking.index === -1) times.push(value); else times[picking.index] = value;
        return { ...m, times: [...new Set(times)] };
      }) }));
    }
  };

  const patchMed = (id, patch) =>
    setT(prev => ({ ...prev, meds: prev.meds.map(m => (m.id === id ? { ...m, ...patch } : m)) }));

  const addMed = () => setT(prev => {
    const used = prev.meds.map(m => m.color);
    const color = COLOR_ORDER.find(c => !used.includes(c)) || COLOR_ORDER[prev.meds.length % COLOR_ORDER.length];
    return { ...prev, meds: [...prev.meds, { ...newMed(prev.meds.length), color }] };
  });

  const removeMed = id => setT(prev => ({ ...prev, meds: prev.meds.filter(m => m.id !== id) }));

  const save = () => {
    const feedings = [...t.feedings].sort((a, b) => t2m(a) - t2m(b));
    const clean = {
      ...t,
      feedings,
      meds: t.meds.map(m => ({
        ...m,
        name: m.name.trim(),
        dose: m.dose.trim(),
        days: m.days === '' ? 1 : Math.max(0, Number(m.days) || 0),
        foodMin: Math.max(0, Number(m.foodMin) || 0),
        foodTimes: (m.foodTimes || []).filter(f => feedings.includes(f)),
        times: m.food !== 'none' && feedings.length ? effectiveTimes(m, feedings) : [...m.times].sort((a, b) => t2m(a) - t2m(b)),
      })),
    };
    const errs = validate(clean);
    setErrors(errs);
    if (errs.length) return;
    onSave(clean);
  };

  return (
    <div className="sheet-full">
      <div className="max-w-lg mx-auto px-5 pt-6 pb-32">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="eyebrow">{isNew ? 'novo tratamento' : 'editar'}</p>
            <h2 className="text-2xl font-semibold tracking-tight">Remédios</h2>
          </div>
          <button onClick={onCancel} className="icon-btn" aria-label="Fechar"><X size={16} /></button>
        </header>

        {/* Start date */}
        <section className="card mb-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Início</span>
            <input type="date" className="input w-auto" value={t.startDate}
                   onChange={e => setT(prev => ({ ...prev, startDate: e.target.value }))} />
          </label>
        </section>

        {/* Feedings */}
        <section className="card mb-4">
          <div className="flex items-center gap-2 mb-1">
            <PawPrint size={14} style={{ color: COLORS.feed.a }} />
            <span className="text-sm font-medium">Ração</span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Opcional. Com os horários da ração você pode marcar um remédio como antes, junto ou depois de comer.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[...t.feedings].sort((a, b) => t2m(a) - t2m(b)).map((time) => {
              const index = t.feedings.indexOf(time);
              return (
                <span key={time} className="time-pill">
                  <button className="tabular-nums" onClick={() => setPicking({ kind: 'feed', index, value: time })}>{time}</button>
                  <button onClick={() => setT(prev => ({ ...prev, feedings: prev.feedings.filter((_, j) => j !== index) }))}
                          aria-label="Remover horário da ração"><X size={12} /></button>
                </span>
              );
            })}
            <button className="chip" onClick={() => setPicking({ kind: 'feed', index: -1, value: t.feedings.length ? '20:00' : '08:00' })}>
              <Plus size={12} /> horário da ração
            </button>
          </div>
        </section>

        {/* Meds */}
        <div className="flex flex-col gap-3">
          {t.meds.map((med, idx) => {
            const c = COLORS[med.color];
            return (
              <section key={med.id} className="card">
                <div className="flex items-center gap-3 mb-3">
                  <button
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    style={{ background: c.a, outline: `3px solid ${c.soft}` }}
                    aria-label="Trocar cor"
                    aria-expanded={colorOpen === med.id}
                    onClick={() => setColorOpen(colorOpen === med.id ? null : med.id)} />
                  <input className="input flex-1 text-base font-medium" placeholder={`Remédio ${idx + 1}`} value={med.name}
                         onChange={e => patchMed(med.id, { name: e.target.value })}
                         autoFocus={(isNew && idx === 0) || (startWithNew && idx === t.meds.length - 1)} />
                  {t.meds.length > 1 && (
                    <button onClick={() => removeMed(med.id)} className="icon-btn" aria-label="Remover"><Trash2 size={14} /></button>
                  )}
                </div>

                {colorOpen === med.id && (
                  <div className="flex items-center gap-2.5 mb-4 pl-0.5">
                    {COLOR_ORDER.map(k => {
                      const cc = COLORS[k];
                      const on = med.color === k;
                      return (
                        <button key={k} aria-label={`Cor ${k}`}
                                onClick={() => { patchMed(med.id, { color: k }); setColorOpen(null); }}
                                className="w-7 h-7 rounded-full flex items-center justify-center transition-transform active:scale-90"
                                style={{ background: cc.a, outline: on ? `3px solid ${cc.soft}` : 'none', transform: on ? 'scale(1.1)' : 'none' }}>
                          {on && <span className="w-2 h-2 rounded-full" style={{ background: '#fff' }} />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <p className="eyebrow mb-2">dose</p>
                <DoseField dose={med.dose} onChange={dose => patchMed(med.id, { dose })} id={med.id} />

                <p className="eyebrow mb-2">em relação à ração</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {FOOD_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => patchMed(med.id, { food: o.value })}
                            className={`chip ${med.food === o.value ? 'chip-on' : ''}`}>{o.label}</button>
                  ))}
                </div>
                {(med.food === 'before' || med.food === 'after') && (
                  <div className="mb-2">
                    <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>quanto tempo {med.food === 'before' ? 'antes' : 'depois'}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {[15, 30, 45, 60, 120].map(v => (
                        <button key={v} onClick={() => patchMed(med.id, { foodMin: v })}
                                className={`chip tabular-nums ${Number(med.foodMin) === v ? 'chip-on' : ''}`}>{v} min</button>
                      ))}
                      <span className="time-pill">
                        <input
                          id={`foodmin-${med.id}`}
                          inputMode="numeric"
                          aria-label="Minutos"
                          value={med.foodMin}
                          onChange={e => patchMed(med.id, { foodMin: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                          onBlur={() => patchMed(med.id, { foodMin: Math.min(240, Math.max(1, Number(med.foodMin) || 30)) })}
                          style={{ width: 40, textAlign: 'center' }} />
                        <span style={{ color: 'var(--muted)' }}>min</span>
                      </span>
                    </div>
                  </div>
                )}
                {med.food !== 'none' && t.feedings.length > 1 && (
                  <div className="mb-2">
                    <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>em quais refeições</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...t.feedings].sort((a, b) => t2m(a) - t2m(b)).map(f => {
                        const meals = mealsFor(med, t.feedings);
                        const on = meals.includes(f);
                        return (
                          <button key={f} className={`chip tabular-nums ${on ? 'chip-on' : ''}`}
                                  onClick={() => {
                                    const next = on ? meals.filter(x => x !== f) : [...meals, f];
                                    if (!next.length) return; // keep at least one meal
                                    patchMed(med.id, { foodTimes: next.length === t.feedings.length ? [] : next });
                                  }}>
                            {f} · {mealLabel(f)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {med.food !== 'none' && (
                  <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                    {t.feedings.length
                      ? <>horários: <span className="tabular-nums" style={{ color: 'var(--fg)' }}>{effectiveTimes(med, t.feedings).join(' · ')}</span></>
                      : 'defina os horários da ração acima'}
                  </p>
                )}

                {med.food === 'none' && (<>
                <p className="eyebrow mb-2">frequência</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {FREQ_PRESETS.map(p => (
                    <button key={p.label}
                            onClick={() => patchMed(med.id, { freq: p.hours, times: deriveTimes(med.times[0] || '08:00', p.hours) })}
                            className={`chip ${med.freq === p.hours ? 'chip-on' : ''}`}>{p.label}</button>
                  ))}
                  <button onClick={() => patchMed(med.id, { freq: 'custom' })}
                          className={`chip ${med.freq === 'custom' ? 'chip-on' : ''}`}>outros horários</button>
                </div>

                {med.freq !== 'custom' ? (
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div>
                      <p className="eyebrow mb-1">primeira dose</p>
                      <p className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{med.times.join(' · ')}</p>
                    </div>
                    <button className="chip tabular-nums"
                            onClick={() => setPicking({ kind: 'med', medId: med.id, index: 0, value: med.times[0] || '08:00' })}>
                      {med.times[0] || '08:00'}
                    </button>
                  </div>
                ) : (<>
                <p className="eyebrow mb-2">horários</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[...med.times].sort((a, b) => t2m(a) - t2m(b)).map((time) => {
                    const index = med.times.indexOf(time);
                    return (
                      <span key={time} className="time-pill">
                        <button className="tabular-nums" onClick={() => setPicking({ kind: 'med', medId: med.id, index, value: time })}>{time}</button>
                        <button onClick={() => patchMed(med.id, { times: med.times.filter((_, j) => j !== index) })}
                                aria-label="Remover horário"><X size={12} /></button>
                      </span>
                    );
                  })}
                  <button className="chip" onClick={() => setPicking({ kind: 'med', medId: med.id, index: -1, value: '12:00' })}>
                    <Plus size={12} /> horário
                  </button>
                </div>
                </>)}
                </>)}

                <p className="eyebrow mb-2">duração</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DAY_PRESETS.map(d => (
                    <button key={d} onClick={() => patchMed(med.id, { days: d })}
                            className={`chip tabular-nums ${Number(med.days) === d ? 'chip-on' : ''}`}>{d}</button>
                  ))}
                  <button onClick={() => patchMed(med.id, { days: 0 })}
                          className={`chip ${Number(med.days) === 0 && med.days !== '' ? 'chip-on' : ''}`}>sempre</button>
                  <span className="time-pill">
                    <input
                      id={`days-${med.id}`}
                      inputMode="numeric"
                      aria-label="Dias de tratamento"
                      placeholder="nº"
                      value={Number(med.days) === 0 ? '' : med.days}
                      onChange={e => patchMed(med.id, { days: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      onBlur={() => patchMed(med.id, { days: med.days === '' ? 0 : Math.min(365, Math.max(1, Number(med.days) || 1)) })}
                      style={{ width: 40, textAlign: 'center' }} />
                    <span style={{ color: 'var(--muted)' }}>dias</span>
                  </span>
                </div>
              </section>
            );
          })}
        </div>

        <button onClick={addMed} className="btn w-full mt-3"><Plus size={14} /> Adicionar remédio</button>

        {errors.length > 0 && (
          <ul className="mt-4 text-sm" style={{ color: COLORS.red.a }}>
            {errors.map((e, i) => <li key={i}>• {e}</li>)}
          </ul>
        )}

        {!isNew && (
          <button onClick={() => { if (confirm('Encerrar o tratamento atual? As doses marcadas serão apagadas.')) onEnd(); }}
                  className="btn w-full mt-6" style={{ color: COLORS.red.a }}>
            <Trash2 size={14} /> Encerrar tratamento
          </button>
        )}
      </div>

      {picking && (
        <TimePicker
          value={picking.value}
          title={picking.kind === 'feed' ? 'Horário da ração' : 'Horário do remédio'}
          onChange={applyPick}
          onClose={() => setPicking(null)} />
      )}

      <div className="sheet-footer">
        <div className="max-w-lg mx-auto px-5 flex gap-2">
          <button onClick={onCancel} className="btn flex-1">Cancelar</button>
          <button onClick={save} className="btn btn-primary flex-[2]">Salvar</button>
        </div>
      </div>
    </div>
  );
}


function DoseField({ dose, onChange, id }) {
  const { qty, unit } = parseDose(dose);
  const customUnit = unit !== '' && !UNITS.includes(unit);
  const [otherOpen, setOtherOpen] = useState(customUnit);
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
        {QTY_PRESETS.map(q => (
          <button key={q} onClick={() => onChange(joinDose(q, unit))}
                  className={`chip tabular-nums ${qty === q ? 'chip-on' : ''}`}>{q}</button>
        ))}
        <span className="time-pill">
          <input
            id={`qty-${id}`}
            inputMode="decimal"
            aria-label="Quantidade"
            placeholder="qtd"
            value={QTY_PRESETS.includes(qty) ? '' : qty}
            onChange={e => onChange(joinDose(e.target.value, unit))}
            style={{ width: 48, textAlign: 'center' }} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {UNITS.map(u => (
          <button key={u} onClick={() => { setOtherOpen(false); onChange(joinDose(qty, u)); }}
                  className={`chip ${unit === u ? 'chip-on' : ''}`}>{u}</button>
        ))}
        {otherOpen ? (
          <span className="time-pill">
            <input
              id={`unit-${id}`}
              aria-label="Unidade"
              placeholder="unidade"
              autoFocus
              value={customUnit ? unit : ''}
              onChange={e => onChange(joinDose(qty, e.target.value))}
              style={{ width: 80 }} />
          </span>
        ) : (
          <button onClick={() => { setOtherOpen(true); onChange(joinDose(qty, '')); }}
                  className={`chip ${customUnit ? 'chip-on' : ''}`}>outra</button>
        )}
      </div>
    </div>
  );
}
