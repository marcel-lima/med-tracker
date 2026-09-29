import { useState } from 'react';
import { X, Plus, Trash2, PawPrint, Dog } from 'lucide-react';
import { COLORS, COLOR_ORDER, FREQ_PRESETS, FOOD_OPTIONS, newMed, newPet, normalize, validate, t2m, effectiveTimes, deriveTimes, inferFreq, mealsFor, mealLabel, todayISO, fromISODate, formatDate } from '../lib/treatment';
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
// A med added mid-treatment starts today; undefined = same day as the treatment.
const laterStart = treatmentStart => (todayISO() > (treatmentStart || '') ? todayISO() : undefined);


export default function TreatmentEditor({ initial, onSave, onCancel, onEnd, startWithNew = false, newPetId = null }) {
  const [t, setT] = useState(() => {
    const base = normalize(initial);
    const firstPet = base.pets[0].id;
    const meds = base.meds.map(m => ({ ...newMed(0, firstPet), ...m, times: [...m.times], freq: m.freq ?? inferFreq(m.times) }));
    if (!meds.length) meds.push(newMed(0, firstPet));
    else if (startWithNew) {
      const used = meds.map(m => m.color);
      const color = COLOR_ORDER.find(c => !used.includes(c)) || COLOR_ORDER[meds.length % COLOR_ORDER.length];
      const petId = base.pets.some(p => p.id === newPetId) ? newPetId : firstPet;
      meds.push({ ...newMed(meds.length, petId), color, startDate: laterStart(base.startDate) });
    }
    return { ...base, pets: base.pets.map(p => ({ ...p, feedings: [...(p.feedings || [])] })), meds };
  });
  const [errors, setErrors] = useState([]);
  // { kind: 'feed' | 'med', petId?, medId?, index, value } while a time is being edited
  const [picking, setPicking] = useState(null);
  const [colorOpen, setColorOpen] = useState(null); // med id with the color row open
  const isNew = initial.meds.length === 0;

  const applyPick = (value) => {
    if (!picking) return;
    if (picking.kind === 'feed') {
      setT(prev => ({ ...prev, pets: prev.pets.map(p => {
        if (p.id !== picking.petId) return p;
        const feedings = [...p.feedings];
        if (picking.index === -1) feedings.push(value); else feedings[picking.index] = value;
        return { ...p, feedings: [...new Set(feedings)] };
      }) }));
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

  const addMed = (petId) => setT(prev => {
    const used = prev.meds.map(m => m.color);
    const color = COLOR_ORDER.find(c => !used.includes(c)) || COLOR_ORDER[prev.meds.length % COLOR_ORDER.length];
    const pid = prev.pets.some(p => p.id === petId) ? petId : (prev.meds.at(-1)?.petId || prev.pets[0].id);
    return { ...prev, meds: [...prev.meds, { ...newMed(prev.meds.length, pid), color, startDate: laterStart(prev.startDate) }] };
  });

  const removeMed = id => setT(prev => ({ ...prev, meds: prev.meds.filter(m => m.id !== id) }));

  const patchPet = (id, patch) => setT(prev => ({ ...prev, pets: prev.pets.map(p => (p.id === id ? { ...p, ...patch } : p)) }));
  const addPet = () => setT(prev => ({ ...prev, pets: [...prev.pets, newPet()] }));
  const removePet = id => setT(prev => {
    if (prev.pets.length <= 1) return prev;
    const owned = prev.meds.filter(m => m.petId === id);
    if (owned.length && !confirm(`Remover este pet e seus ${owned.length} remédio(s)?`)) return prev;
    return { ...prev, pets: prev.pets.filter(p => p.id !== id), meds: prev.meds.filter(m => m.petId !== id) };
  });
  const petFeedings = petId => t.pets.find(p => p.id === petId)?.feedings || [];

  const save = () => {
    const pets = t.pets.map(p => ({ ...p, name: (p.name || '').trim().slice(0, 30), feedings: [...p.feedings].sort((a, b) => t2m(a) - t2m(b)) }));
    const clean = {
      ...t,
      pets,
      meds: t.meds.map(m => {
        const feedings = pets.find(p => p.id === m.petId)?.feedings || [];
        return {
          ...m,
          name: m.name.trim(),
          dose: m.dose.trim(),
          days: m.days === '' ? 1 : Math.max(0, Number(m.days) || 0),
          startDate: m.startDate && m.startDate !== t.startDate ? m.startDate : undefined,
          startTime: (() => {
            const times = (m.food !== 'none' && feedings.length ? effectiveTimes(m, feedings) : [...m.times]).sort((a, b) => t2m(a) - t2m(b));
            return times.indexOf(m.startTime) > 0 ? m.startTime : undefined;
          })(),
          foodMin: Math.max(0, Number(m.foodMin) || 0),
          foodTimes: (m.foodTimes || []).filter(f => feedings.includes(f)),
          times: m.food !== 'none' && feedings.length ? effectiveTimes(m, feedings) : [...m.times].sort((a, b) => t2m(a) - t2m(b)),
        };
      }),
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

        {/* Pets: name, pronoun and meal times, one card each */}
        {t.pets.map((pet, pi) => (
          <section key={pet.id} className="card mb-4 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Dog size={16} style={{ color: COLORS.feed.a, flexShrink: 0 }} />
              <input id={`pet-name-${pet.id}`} className="input flex-1 text-base font-medium" placeholder={t.pets.length > 1 ? `Pet ${pi + 1}` : 'ex.: Kika'}
                     value={pet.name || ''} onChange={e => patchPet(pet.id, { name: e.target.value.slice(0, 30) })} />
              <div className="flex gap-1">
                <button onClick={() => patchPet(pet.id, { sex: 'f' })} className={`chip ${pet.sex !== 'm' ? 'chip-on' : ''}`} aria-label="Fêmea">ela</button>
                <button onClick={() => patchPet(pet.id, { sex: 'm' })} className={`chip ${pet.sex === 'm' ? 'chip-on' : ''}`} aria-label="Macho">ele</button>
              </div>
              {t.pets.length > 1 && (
                <button onClick={() => removePet(pet.id)} className="icon-btn" aria-label="Remover pet"><Trash2 size={14} /></button>
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <PawPrint size={13} style={{ color: COLORS.feed.a }} />
                <span className="text-xs font-medium">Ração{pet.name ? ` de ${pet.name}` : ''}</span>
              </div>
              <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                Opcional. Com os horários da ração você pode marcar um remédio como antes, junto ou depois de comer.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[...pet.feedings].sort((a, b) => t2m(a) - t2m(b)).map((time) => {
                  const index = pet.feedings.indexOf(time);
                  return (
                    <span key={time} className="time-pill">
                      <button className="tabular-nums" onClick={() => setPicking({ kind: 'feed', petId: pet.id, index, value: time })}>{time}</button>
                      <button onClick={() => patchPet(pet.id, { feedings: pet.feedings.filter((_, j) => j !== index) })}
                              aria-label="Remover horário da ração"><X size={12} /></button>
                    </span>
                  );
                })}
                <button className="chip" onClick={() => setPicking({ kind: 'feed', petId: pet.id, index: -1, value: pet.feedings.length ? '20:00' : '08:00' })}>
                  <Plus size={12} /> horário da ração
                </button>
              </div>
            </div>
          </section>
        ))}
        <button onClick={addPet} className="btn w-full mb-4"><Plus size={14} /> Adicionar pet</button>

        <section className="card mb-4">
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">Início do tratamento</span>
            <input type="date" className="input w-auto" value={t.startDate}
                   onChange={e => setT(prev => ({ ...prev, startDate: e.target.value }))} />
          </label>
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

                {t.pets.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-4">
                    <span className="eyebrow mr-1">de</span>
                    {t.pets.map((p, pi) => (
                      <button key={p.id} onClick={() => patchMed(med.id, { petId: p.id, foodTimes: [] })}
                              className={`chip ${med.petId === p.id ? 'chip-on' : ''}`}>{p.name || `Pet ${pi + 1}`}</button>
                    ))}
                  </div>
                )}

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
                      <span className={`time-pill ${med.foodMin !== '' && ![15, 30, 45, 60, 120].includes(Number(med.foodMin)) ? 'pill-on' : ''}`}>
                        <input
                          id={`foodmin-${med.id}`}
                          inputMode="numeric"
                          aria-label="Minutos"
                          value={med.foodMin}
                          onChange={e => patchMed(med.id, { foodMin: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                          onBlur={() => patchMed(med.id, { foodMin: Math.min(240, Math.max(1, Number(med.foodMin) || 30)) })}
                          style={{ width: '2.5rem', textAlign: 'center' }} />
                        <span style={{ color: 'var(--muted)' }}>min</span>
                      </span>
                    </div>
                  </div>
                )}
                {med.food !== 'none' && petFeedings(med.petId).length > 1 && (
                  <div className="mb-2">
                    <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>em quais refeições</p>
                    <div className="flex flex-wrap gap-1.5">
                      {[...petFeedings(med.petId)].sort((a, b) => t2m(a) - t2m(b)).map(f => {
                        const meals = mealsFor(med, petFeedings(med.petId));
                        const on = meals.includes(f);
                        return (
                          <button key={f} className={`chip tabular-nums ${on ? 'chip-on' : ''}`}
                                  onClick={() => {
                                    const next = on ? meals.filter(x => x !== f) : [...meals, f];
                                    if (!next.length) return; // keep at least one meal
                                    patchMed(med.id, { foodTimes: next.length === petFeedings(med.petId).length ? [] : next });
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
                    {petFeedings(med.petId).length
                      ? <>horários: <span className="tabular-nums" style={{ color: 'var(--fg)' }}>{effectiveTimes(med, petFeedings(med.petId)).join(' · ')}</span></>
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

                <p className="eyebrow mb-2">começou em</p>
                <div className="flex flex-wrap items-center gap-1.5 mb-4">
                  <button onClick={() => patchMed(med.id, { startDate: undefined })}
                          className={`chip ${!med.startDate || med.startDate === t.startDate ? 'chip-on' : ''}`}>início do tratamento</button>
                  <button onClick={() => patchMed(med.id, { startDate: todayISO() })}
                          className={`chip ${med.startDate === todayISO() && todayISO() !== t.startDate ? 'chip-on' : ''}`}>hoje</button>
                  <input type="date" aria-label="Data em que começou este remédio"
                         className={`input w-auto ${med.startDate && med.startDate !== t.startDate && med.startDate !== todayISO() ? 'input-on' : ''}`}
                         style={{ height: '2.125rem', fontSize: '0.8125rem' }}
                         value={med.startDate || t.startDate}
                         onChange={e => patchMed(med.id, { startDate: e.target.value || undefined })} />
                </div>
                {med.startDate && med.startDate !== t.startDate && (
                  <p className="text-xs -mt-2 mb-4" style={{ color: 'var(--muted)' }}>
                    Aparece só a partir de {formatDate(fromISODate(med.startDate))}; dias anteriores não ficam pendentes.
                  </p>
                )}
                {(() => {
                  const times = (med.food !== 'none' ? effectiveTimes(med, petFeedings(med.petId)) : [...med.times]).sort((a, b) => t2m(a) - t2m(b));
                  if (times.length < 2) return null;
                  const sel = times.includes(med.startTime) ? med.startTime : times[0];
                  const skipped = times.indexOf(sel);
                  return (
                    <div className="mb-4">
                      <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>no primeiro dia, começou pela dose das</p>
                      <div className="flex flex-wrap gap-1.5">
                        {times.map((tm, i) => (
                          <button key={tm} onClick={() => patchMed(med.id, { startTime: i === 0 ? undefined : tm })}
                                  className={`chip tabular-nums ${sel === tm ? 'chip-on' : ''}`}>{tm}</button>
                        ))}
                      </div>
                      {skipped > 0 && Number(med.days) > 0 && (() => {
                        const end = fromISODate(med.startDate || t.startDate); end.setDate(end.getDate() + Number(med.days));
                        return (
                          <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                            {Number(med.days) * times.length} doses no total ({med.days} dias × {times.length}); {skipped === 1 ? 'a dose pulada' : `as ${skipped} doses puladas`} no primeiro dia {skipped === 1 ? 'é compensada' : 'são compensadas'} no fim. Última dose: {formatDate(end)} · {times[skipped - 1]}.
                          </p>
                        );
                      })()}
                    </div>
                  );
                })()}

                <p className="eyebrow mb-2">duração</p>
                <div className="flex flex-wrap items-center gap-1.5">
                  {DAY_PRESETS.map(d => (
                    <button key={d} onClick={() => patchMed(med.id, { days: d })}
                            className={`chip tabular-nums ${Number(med.days) === d ? 'chip-on' : ''}`}>{d}</button>
                  ))}
                  <button onClick={() => patchMed(med.id, { days: 0 })}
                          className={`chip ${Number(med.days) === 0 && med.days !== '' ? 'chip-on' : ''}`}>sempre</button>
                  <span className={`time-pill ${med.days !== '' && Number(med.days) > 0 && !DAY_PRESETS.includes(Number(med.days)) ? 'pill-on' : ''}`}>
                    <input
                      id={`days-${med.id}`}
                      inputMode="numeric"
                      aria-label="Dias de tratamento"
                      placeholder="nº"
                      value={Number(med.days) === 0 ? '' : med.days}
                      onChange={e => patchMed(med.id, { days: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      onBlur={() => patchMed(med.id, { days: med.days === '' ? 0 : Math.min(365, Math.max(1, Number(med.days) || 1)) })}
                      style={{ width: '2.5rem', textAlign: 'center' }} />
                    <span style={{ color: 'var(--muted)' }}>dias</span>
                  </span>
                </div>
              </section>
            );
          })}
        </div>

        <button onClick={() => addMed()} className="btn w-full mt-3"><Plus size={14} /> Adicionar remédio</button>

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
        <span className={`time-pill ${qty && !QTY_PRESETS.includes(qty) ? 'pill-on' : ''}`}>
          <input
            id={`qty-${id}`}
            inputMode="decimal"
            aria-label="Quantidade"
            placeholder="qtd"
            value={QTY_PRESETS.includes(qty) ? '' : qty}
            onChange={e => onChange(joinDose(e.target.value, unit))}
            style={{ width: '3rem', textAlign: 'center' }} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {UNITS.map(u => (
          <button key={u} onClick={() => { setOtherOpen(false); onChange(joinDose(qty, u)); }}
                  className={`chip ${unit === u ? 'chip-on' : ''}`}>{u}</button>
        ))}
        {otherOpen ? (
          <span className="time-pill pill-on">
            <input
              id={`unit-${id}`}
              aria-label="Unidade"
              placeholder="unidade"
              autoFocus
              value={customUnit ? unit : ''}
              onChange={e => onChange(joinDose(qty, e.target.value))}
              style={{ width: '5rem' }} />
          </span>
        ) : (
          <button onClick={() => { setOtherOpen(true); onChange(joinDose(qty, '')); }}
                  className={`chip ${customUnit ? 'chip-on' : ''}`}>outra</button>
        )}
      </div>
    </div>
  );
}
