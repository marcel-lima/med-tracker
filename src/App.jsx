import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, Sun, Moon, Bell, Pencil, Plus, PawPrint } from 'lucide-react';
import { storage } from './lib/storage';
import {
  COLORS, FEED_ID, buildDays, buildReminders, emptyTreatment, isActive, totalDays, findNextSlot,
  dayProgress, medsForSlot, medById, allMeds, foodNote, formatDate, todayISO, DOW,
} from './lib/treatment';
import { saveTreatment, clearTreatment, fetchTreatment, setChecked as syncChecked } from './lib/api';
import { ensureRegistered } from './lib/push';
import PillClock from './components/PillClock';
import TreatmentEditor from './components/TreatmentEditor';
import NotifSheet from './components/NotifSheet';

const prefersDark = () => window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export default function App() {
  const [dark, setDark] = useState(() => {
    const saved = storage.get('mt_theme');
    return saved ? saved === 'dark' : prefersDark();
  });
  const [treatment, setTreatment] = useState(() => storage.get('mt_treatment') || emptyTreatment());
  const [checked, setChecked] = useState(() => storage.get('mt_checked_v2') || {});
  const [selDate, setSelDate] = useState(todayISO());
  const [now, setNow] = useState(new Date());
  const [showEditor, setShowEditor] = useState(false); // false | true | 'new'
  const [showNotif, setShowNotif] = useState(false);
  const [toast, setToast] = useState(null);
  const [name, setName] = useState(() => storage.get('mt_name') || ''); // this device's person
  const [scrolled, setScrolled] = useState(false);
  const toastTimer = useRef(null);

  const active = isActive(treatment);
  const days = useMemo(() => buildDays(treatment), [treatment]);
  const meds = useMemo(() => allMeds(treatment), [treatment]);
  const today = todayISO();
  const todayDay = days.find(d => d.date === today) || null;
  const selIdx = useMemo(() => {
    if (!days.length) return 0;
    const wanted = days.findIndex(d => d.date === selDate);
    if (wanted >= 0) return wanted;
    const t = days.findIndex(d => d.date === today);
    if (t >= 0) return t;
    return today < days[0].date ? 0 : days.length - 1;
  }, [days, selDate, today]);
  const selDay = days[selIdx] || null;
  const nextSlot = useMemo(() => findNextSlot(days, checked, now), [days, checked, now]);

  // ─ Persistence ─
  useEffect(() => { storage.set('mt_treatment', treatment); }, [treatment]);
  useEffect(() => { storage.set('mt_checked_v2', checked); }, [checked]);
  useEffect(() => {
    storage.set('mt_theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Re-sync reminders with the server once a day (keeps continuous meds covered)
  useEffect(() => {
    if (!isActive(treatment)) return;
    const last = Number(storage.get('mt_synced_at')) || 0;
    if (Date.now() - last < 20 * 3600e3) return;
    storage.set('mt_synced_at', Date.now());
    saveTreatment(treatment, buildReminders(treatment), Object.keys(checked));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Collapse the header after a little scrolling (hysteresis avoids flicker)
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrolled(prev => (prev ? y > 24 : y > 64));
        ticking = false;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const showToast = useCallback((msg) => {
    clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  // Compare with the server and keep whichever is newer. Runs on open and
  // whenever the app comes back to the foreground, so marks made on another
  // phone (or a reinstall) show up without restarting.
  const reconcile = useCallback(async () => {
    ensureRegistered(); // keep this device's push registration on the server
    const data = await fetchTreatment();
    if (!data?.treatment || !isActive(data.treatment)) return;
    const serverAt = Number(data.treatment.updatedAt) || 0;
    setTreatment(local => {
      const localAt = Number(local.updatedAt) || 0;
      if (isActive(local) && localAt >= serverAt) return local;
      showToast(isActive(local) ? 'tratamento atualizado' : 'tratamento recuperado');
      return data.treatment;
    });
    setChecked(local => {
      const merged = { ...local };
      const by = data.checkedBy || {};
      (data.checked || []).forEach(k => { merged[k] = by[k] ? { by: by[k] } : (merged[k] || true); });
      return merged;
    });
  }, [showToast]);

  const askName = () => {
    const v = window.prompt('Seu nome (aparece na saudação e em quem deu a dose):', name);
    if (v === null) return;
    const clean = v.trim().slice(0, 40);
    setName(clean);
    storage.set('mt_name', clean);
  };

  useEffect(() => {
    Promise.resolve().then(reconcile);
    const onVisible = () => { if (document.visibilityState === 'visible') reconcile(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reconcile]);

  // ─ Actions ─
  const toggleDose = useCallback((dose, day) => {
    setChecked(prev => {
      const value = !prev[dose.key];
      const next = { ...prev, [dose.key]: name ? { by: name, at: Date.now() } : true };
      if (!value) delete next[dose.key];
      syncChecked(dose.key, value, name);
      const { total, done } = dayProgress(day, next);
      if (value && total > 0 && done === total) showToast('dia completo');
      return next;
    });
  }, [showToast, name]);

  const handleSave = (raw) => {
    const t = { ...raw, updatedAt: Date.now() };
    setTreatment(t);
    setSelDate(todayISO());
    setShowEditor(false);
    storage.set('mt_synced_at', Date.now());
    saveTreatment(t, buildReminders(t), Object.keys(checked));
    showToast('tratamento salvo');
  };

  const handleEnd = () => {
    setTreatment(emptyTreatment());
    setChecked({});
    setShowEditor(false);
    clearTreatment();
  };

  const handleReminders = (reminders) => {
    const t = { ...treatment, reminders, updatedAt: Date.now() };
    setTreatment(t);
    if (isActive(t)) saveTreatment(t, buildReminders(t), Object.keys(checked));
  };

  // ─ Derived text ─
  const greeting = useMemo(() => {
    const h = now.getHours();
    const g = h >= 5 && h < 12 ? 'bom dia' : h >= 12 && h < 18 ? 'boa tarde' : 'boa noite';
    return name ? `${g}, ${name}` : g;
  }, [now, name]);

  const nextMeds = nextSlot ? medsForSlot(treatment, nextSlot.slot) : [];
  const nextIsToday = nextSlot?.day.date === today;
  const nextLabel = !nextSlot ? null
    : nextIsToday ? 'próxima dose'
    : nextSlot.day.date === daysAfter(today, 1) ? 'amanhã'
    : formatDate(nextSlot.day.dateObj);

  return (
    <div className="min-h-screen">
      {/* ── Header: sticky, collapses to one line once the page scrolls ── */}
      <header className={`app-header ${scrolled ? 'compact' : ''}`}>
        <div className="max-w-lg mx-auto px-5 flex items-start justify-between">
          <div className="min-w-0">
            <button onClick={askName} className="greet eyebrow text-left block" title="Definir seu nome">
              {greeting}{!name && ' · seu nome?'}
            </button>
            <h1 className="title leading-none font-bold tracking-tight m-0" style={{ color: 'var(--title)' }}>
              {treatment.pet ? <>Remédios da <span style={{ color: 'var(--title-name)' }}>{treatment.pet}</span></> : 'Remédios'}
            </h1>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            {active && (
              <button onClick={() => setShowEditor(true)} className="icon-btn" aria-label="Editar tratamento">
                <Pencil size={15} />
              </button>
            )}
            <button onClick={() => setShowNotif(true)} className="icon-btn" aria-label="Lembretes"><Bell size={15} /></button>
            <button onClick={() => setDark(d => !d)} className="icon-btn" aria-label="Tema">
              {dark ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-lg mx-auto px-5 pt-2 safe-bottom">

        {/* ── Clock ── */}
        <div className="mb-5">
          <PillClock meds={meds} today={todayDay} checked={checked}
                     target={nextSlot?.slot.time || null} now={now} dark={dark} />
        </div>

        {!active ? (
          /* ── Empty state ── */
          <div className="text-center fade-up" style={{ animationDelay: '.5s' }}>
            <p className="eyebrow mb-2">nenhum tratamento</p>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Comece por aqui</h2>
            <p className="text-sm mb-6 mx-auto max-w-[280px]" style={{ color: 'var(--muted)' }}>
              Cadastre os remédios da receita, os horários e por quantos dias. O resto o app cuida.
            </p>
            <button onClick={() => setShowEditor(true)} className="btn btn-primary"><Plus size={16} /> Adicionar remédios</button>
          </div>
        ) : (
          <>
            {/* ── Next dose ── */}
            <div className="text-center mb-8 fade-up" style={{ animationDelay: '.5s' }}>
              {nextSlot ? (
                <>
                  <p className="eyebrow mb-1">{nextLabel}</p>
                  <div className="text-[3.5rem] leading-none font-semibold tracking-tight tabular-nums mb-2">{nextSlot.slot.time}</div>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {nextMeds.map(m => (
                      <span key={m.id} className="text-xs px-2.5 py-1 rounded-full font-medium inline-flex items-center gap-1"
                            style={{ background: COLORS[m.color].soft, color: COLORS[m.color].ink }}>
                        {m.id === FEED_ID && <PawPrint size={11} />}{m.name}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <p className="eyebrow mb-1">tudo em dia</p>
                  <div className="text-2xl font-semibold tracking-tight">Nenhuma dose pendente</div>
                </>
              )}
            </div>

            {/* ── Day strip ── */}
            <div className="flex gap-1 mb-6 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
              {days.map((day, i) => {
                const { total, done } = dayProgress(day, checked);
                const isToday = day.date === today;
                const isSel = i === selIdx;
                const complete = total > 0 && done === total;
                return (
                  <button key={day.date} onClick={() => setSelDate(day.date)}
                          className="flex-shrink-0 flex flex-col items-center gap-1 w-[2.5rem] py-2 rounded-2xl transition-colors"
                          style={{ background: isSel ? 'var(--card)' : 'transparent', boxShadow: isSel ? '0 1px 2px rgba(28,36,81,.06)' : 'none' }}>
                    <span className="text-[0.5625rem] uppercase tracking-wider" style={{ color: isSel ? 'var(--fg)' : 'var(--muted)' }}>
                      {DOW[day.dateObj.getDay()]}
                    </span>
                    <span className="text-base leading-none font-medium tabular-nums" style={{ color: isSel ? 'var(--fg)' : 'var(--muted)' }}>
                      {day.dateObj.getDate()}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full"
                          style={{ background: complete ? 'var(--ok)' : isToday ? 'var(--accent)' : 'transparent' }} />
                  </button>
                );
              })}
            </div>

            {/* ── Day header ── */}
            {selDay && (
              <div className="flex items-center gap-3 mb-4">
                <button onClick={() => setSelDate(days[Math.max(0, selIdx - 1)].date)} disabled={selIdx === 0}
                        className="icon-btn disabled:opacity-25" aria-label="Dia anterior"><ChevronLeft size={16} /></button>
                <div className="flex-1 min-w-0 text-center">
                  <p className="eyebrow">{totalDays(treatment) === Infinity ? `dia ${selIdx + 1}` : `dia ${selIdx + 1} de ${days.length}`}</p>
                  <p className="text-sm font-medium">{formatDate(selDay.dateObj)}</p>
                </div>
                <button onClick={() => setSelDate(days[Math.min(days.length - 1, selIdx + 1)].date)} disabled={selIdx === days.length - 1}
                        className="icon-btn disabled:opacity-25" aria-label="Próximo dia"><ChevronRight size={16} /></button>
              </div>
            )}

            {/* ── Slots ── */}
            <div className="flex flex-col gap-3">
              {selDay?.slots.map(slot => {
                const done = slot.doses.every(d => checked[d.key]);
                const isNext = nextSlot?.slot.key === slot.key;
                const late = !done && slot.doses[0].at.getTime() < now.getTime() - 60 * 60000;
                return (
                  <div key={slot.key} className="card" style={{ outline: isNext ? '1.5px solid var(--primary)' : 'none' }}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-lg font-semibold tabular-nums" style={{ color: done ? 'var(--muted)' : 'var(--fg)' }}>{slot.time}</span>
                      <span className="eyebrow" style={{ color: isNext && !done ? 'var(--primary)' : late && !done ? 'var(--accent)' : undefined }}>
                        {done ? `dado${slotBy(slot, checked) ? ` · ${slotBy(slot, checked)}` : ''}` : isNext ? 'próxima' : late ? 'atrasada' : ''}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {slot.doses.map(dose => {
                        const med = medById(treatment, dose.medId);
                        if (!med) return null;
                        const c = COLORS[med.color];
                        const on = !!checked[dose.key];
                        return (
                          <button key={dose.key} onClick={() => toggleDose(dose, selDay)}
                                  className="flex items-center gap-3 text-left w-full">
                            <span className="check" style={{ background: on ? c.a : undefined, borderColor: on ? c.a : undefined }}>
                              {on && <Check size={13} color="#fff" strokeWidth={3} />}
                            </span>
                            <span className="flex-1 min-w-0" style={{ opacity: on ? 0.45 : 1 }}>
                              <span className="text-sm font-medium truncate flex items-center gap-1.5"
                                    style={{ textDecoration: on ? 'line-through' : 'none' }}>
                                {med.id === FEED_ID && <PawPrint size={13} style={{ color: c.a }} />}{med.name}
                              </span>
                              {foodNote(med, treatment.feedings) && <span className="block text-[0.6875rem]" style={{ color: 'var(--muted)' }}>{foodNote(med, treatment.feedings)}</span>}
                            </span>
                            <span className="text-xs flex-shrink-0" style={{ color: 'var(--muted)' }}>{med.dose}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── Treatment summary ── */}
            <div className="card mt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="eyebrow">tratamento · {totalDays(treatment) === Infinity ? 'contínuo' : `${totalDays(treatment)} dias`}</p>
                <button onClick={() => setShowEditor(true)} className="text-xs font-medium">editar</button>
              </div>
              <div className="flex flex-col gap-3">
                {meds.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[m.color].a }} />
                    <span className="text-sm font-medium flex-1 truncate">{m.name}</span>
                    <span className="text-xs" style={{ color: 'var(--muted)' }}>{m.id === FEED_ID ? '' : m.dose || foodNote(m, treatment.feedings) || ''}</span>
                    <span className="text-[0.6875rem] tabular-nums" style={{ color: 'var(--muted)' }}>{m.times.join(' · ')}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => setShowEditor('new')} className="btn w-full mt-5" style={{ background: 'var(--bg)' }}>
                <Plus size={14} /> Adicionar remédio
              </button>
            </div>
          </>
        )}
      </div>

      {showEditor && (
        <TreatmentEditor initial={treatment} startWithNew={showEditor === 'new'}
                         onSave={handleSave} onCancel={() => setShowEditor(false)} onEnd={handleEnd} />
      )}

      <NotifSheet open={showNotif} onClose={() => setShowNotif(false)}
                  reminders={treatment.reminders} onChangeReminders={handleReminders} />

      {toast && (
        <div className="toast-enter fixed bottom-8 left-1/2 z-[60] pointer-events-none" style={{ transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium"
               style={{ background: 'var(--primary)', color: 'var(--primary-fg)' }}>
            <Check size={14} strokeWidth={2.5} /> {toast}
          </div>
        </div>
      )}
    </div>
  );
}

// Who marked the slot (first named marker wins)
function slotBy(slot, checked) {
  for (const d of slot.doses) { const v = checked[d.key]; if (v && typeof v === 'object' && v.by) return v.by; }
  return null;
}

function daysAfter(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}
