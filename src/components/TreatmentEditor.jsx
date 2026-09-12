import { useState } from 'react';
import { X, Plus, Trash2, Minus, PawPrint } from 'lucide-react';
import { COLORS, COLOR_ORDER, FREQ_PRESETS, FOOD_OPTIONS, newMed, validate, t2m, effectiveTimes } from '../lib/treatment';

const sameTimes = (a, b) => a.length === b.length && [...a].sort().every((t, i) => t === [...b].sort()[i]);

export default function TreatmentEditor({ initial, onSave, onCancel, onEnd }) {
  const [t, setT] = useState(() => ({
    ...initial,
    feedings: [...(initial.feedings || [])],
    meds: initial.meds.length
      ? initial.meds.map(m => ({ ...newMed(0), ...m, times: [...m.times] }))
      : [newMed(0)],
  }));
  const [errors, setErrors] = useState([]);
  const isNew = initial.meds.length === 0;

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
        days: Number(m.days) || 1,
        foodMin: Math.max(0, Number(m.foodMin) || 0),
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
            {[...t.feedings].sort((a, b) => t2m(a) - t2m(b)).map((time, i) => (
              <span key={`${time}-${i}`} className="time-pill">
                <input type="time" value={time}
                       onChange={e => {
                         const v = e.target.value; if (!v) return;
                         const feedings = [...t.feedings]; feedings[t.feedings.indexOf(time)] = v;
                         setT(prev => ({ ...prev, feedings }));
                       }} />
                <button onClick={() => setT(prev => ({ ...prev, feedings: prev.feedings.filter((_, j) => j !== prev.feedings.indexOf(time)) }))}
                        aria-label="Remover horário da ração"><X size={12} /></button>
              </span>
            ))}
            <button className="chip" onClick={() => setT(prev => ({ ...prev, feedings: [...prev.feedings, prev.feedings.length ? '20:00' : '08:00'] }))}>
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
                    onClick={() => patchMed(med.id, { color: COLOR_ORDER[(COLOR_ORDER.indexOf(med.color) + 1) % COLOR_ORDER.length] })} />
                  <input className="input flex-1 text-base font-medium" placeholder={`Remédio ${idx + 1}`} value={med.name}
                         onChange={e => patchMed(med.id, { name: e.target.value })} autoFocus={isNew && idx === 0} />
                  {t.meds.length > 1 && (
                    <button onClick={() => removeMed(med.id)} className="icon-btn" aria-label="Remover"><Trash2 size={14} /></button>
                  )}
                </div>

                <input className="input w-full mb-4" placeholder="Dose · ex: 1 cp, 1 g, 10 ml" value={med.dose}
                       onChange={e => patchMed(med.id, { dose: e.target.value })} />

                <p className="eyebrow mb-2">em relação à ração</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {FOOD_OPTIONS.map(o => (
                    <button key={o.value} onClick={() => patchMed(med.id, { food: o.value })}
                            className={`chip ${med.food === o.value ? 'chip-on' : ''}`}>{o.label}</button>
                  ))}
                </div>
                {(med.food === 'before' || med.food === 'after') && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>quanto tempo {med.food === 'before' ? 'antes' : 'depois'}</span>
                    <div className="flex items-center gap-2">
                      <button className="icon-btn" onClick={() => patchMed(med.id, { foodMin: Math.max(5, Number(med.foodMin) - 5) })} aria-label="Menos 5 min"><Minus size={14} /></button>
                      <span className="text-sm tabular-nums w-16 text-center">{med.foodMin} min</span>
                      <button className="icon-btn" onClick={() => patchMed(med.id, { foodMin: Math.min(240, Number(med.foodMin) + 5) })} aria-label="Mais 5 min"><Plus size={14} /></button>
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
                  {FREQ_PRESETS.map(p => {
                    const active = sameTimes(p.times, med.times);
                    return (
                      <button key={p.label} onClick={() => patchMed(med.id, { times: [...p.times] })}
                              className={`chip ${active ? 'chip-on' : ''}`}>{p.label}</button>
                    );
                  })}
                </div>

                <p className="eyebrow mb-2">horários</p>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {[...med.times].sort((a, b) => t2m(a) - t2m(b)).map((time, i) => (
                    <span key={`${time}-${i}`} className="time-pill">
                      <input type="time" value={time}
                             onChange={e => {
                               const v = e.target.value; if (!v) return;
                               const times = [...med.times]; times[med.times.indexOf(time)] = v;
                               patchMed(med.id, { times });
                             }} />
                      <button onClick={() => patchMed(med.id, { times: med.times.filter((_, j) => j !== med.times.indexOf(time)) })}
                              aria-label="Remover horário"><X size={12} /></button>
                    </span>
                  ))}
                  <button className="chip" onClick={() => patchMed(med.id, { times: [...med.times, '12:00'] })}>
                    <Plus size={12} /> horário
                  </button>
                </div>
                </>)}

                <div className="flex items-center justify-between">
                  <p className="eyebrow">duração</p>
                  <div className="flex items-center gap-2">
                    <button className="icon-btn" onClick={() => patchMed(med.id, { days: Math.max(1, Number(med.days) - 1) })} aria-label="Menos um dia"><Minus size={14} /></button>
                    <span className="text-sm tabular-nums w-16 text-center">{med.days} {Number(med.days) === 1 ? 'dia' : 'dias'}</span>
                    <button className="icon-btn" onClick={() => patchMed(med.id, { days: Math.min(365, Number(med.days) + 1) })} aria-label="Mais um dia"><Plus size={14} /></button>
                  </div>
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

      <div className="sheet-footer">
        <div className="max-w-lg mx-auto px-5 flex gap-2">
          <button onClick={onCancel} className="btn flex-1">Cancelar</button>
          <button onClick={save} className="btn btn-primary flex-[2]">Salvar</button>
        </div>
      </div>
    </div>
  );
}
