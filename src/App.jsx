import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Check, ArrowRight, Sun, Moon, Bell, BellOff, Download, Trash2 } from 'lucide-react';
import { storage } from './lib/storage';
import { MEDS, MED_ORDER, START, TOTAL_DAYS, DOW_I, MONTHS, SCHEDULE } from './lib/schedule';
import { exportICS } from './lib/notifications';
import NotifSheet from './components/NotifSheet';

const t2m = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

function withHistoric(saved = {}) {
  const result = { ...saved };
  SCHEDULE.forEach((day, d) =>
    day.slots.forEach((slot, s) => {
      if (slot.historic) {
        slot.meds.forEach(mk => { result[`${d}-${s}-${mk}`] ??= true; });
      }
    })
  );
  return result;
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(false);
  const [checked, setChecked] = useState(() => withHistoric({}));
  const [loaded, setLoaded] = useState(false);
  const [selDay, setSelDay] = useState(0);
  const [now, setNow] = useState(new Date());
  const [toast, setToast] = useState(false);
  const [pulsing, setPulsing] = useState(null);
  const [showNotifSheet, setShowNotifSheet] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const toastTimer = useRef(null);

  const todayIdx = useMemo(() => {
    const diff = Math.floor((Date.now() - START.getTime()) / 86400000);
    return Math.max(0, Math.min(diff, TOTAL_DAYS - 1));
  }, []);

  // Load persisted state async (IndexedDB)
  useEffect(() => {
    Promise.all([
      storage.get('mt_checked'),
      storage.get('mt_theme'),
    ]).then(([savedChecked, savedTheme]) => {
      const restoredChecked = withHistoric(savedChecked || {});
      setChecked(restoredChecked);
      if (savedTheme === 'dark') {
        setDark(true);
        document.documentElement.classList.add('dark');
      }
      setLoaded(true);
    });
  }, []);

  // Init selected day to today
  useEffect(() => { setSelDay(todayIdx); }, [todayIdx]);

  // Clock tick every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Persist checked (debounced via useEffect)
  useEffect(() => {
    if (!loaded) return;
    storage.set('mt_checked', checked);
  }, [checked, loaded]);

  useEffect(() => {
    if (!loaded) return;
    storage.set('mt_theme', dark ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', dark);
  }, [dark, loaded]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h >= 5 && h < 12) return 'bom dia';
    if (h >= 12 && h < 18) return 'boa tarde';
    if (h >= 18) return 'boa noite';
    return 'boa madrugada';
  }, [now]);

  // Progress helpers
  const slotDone = useCallback((d, s) => {
    const slot = SCHEDULE[d].slots[s];
    if (slot.historic) return true;
    return slot.meds.every(mk => checked[`${d}-${s}-${mk}`]);
  }, [checked]);

  const dayProgress = useCallback((d) => {
    const day = SCHEDULE[d];
    let total = 0, done = 0;
    day.slots.forEach((slot, s) => {
      if (slot.historic) return;
      slot.meds.forEach(mk => {
        total++;
        if (checked[`${d}-${s}-${mk}`]) done++;
      });
    });
    return { total, done };
  }, [checked]);

  // Next unchecked dose from now
  const nextDose = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (let d = todayIdx; d < TOTAL_DAYS; d++) {
      for (let s = 0; s < SCHEDULE[d].slots.length; s++) {
        const slot = SCHEDULE[d].slots[s];
        if (slot.historic) continue;
        if (slotDone(d, s)) continue;
        if (d === todayIdx && t2m(slot.time) < nowMin - 60) continue;
        return { d, s, slot };
      }
    }
    return null;
  }, [now, slotDone, todayIdx]);

  const toggleMed = useCallback((d, s, mk) => {
    const key = `${d}-${s}-${mk}`;
    setChecked(prev => {
      const next = { ...prev, [key]: !prev[key] };
      // check if day just became 100%
      const { total, done } = (() => {
        let t = 0, dn = 0;
        SCHEDULE[d].slots.forEach((slot, si) => {
          if (slot.historic) return;
          slot.meds.forEach(m => { t++; if (next[`${d}-${si}-${m}`]) dn++; });
        });
        return { total: t, done: dn };
      })();
      if (done === total && total > 0 && next[key]) {
        clearTimeout(toastTimer.current);
        setToast(true);
        toastTimer.current = setTimeout(() => setToast(false), 2400);
        }
      return next;
    });
    setPulsing(key);
    setTimeout(() => setPulsing(null), 600);
  }, []);

  const scrollToSlot = useCallback((d, s) => {
    setSelDay(d);
    setTimeout(() => {
      document.getElementById(`slot-${d}-${s}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 80);
  }, []);

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ checked, exportedAt: new Date().toISOString() }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'remedios-backup.json'; a.click();
  };

  const resetAll = () => {
    if (!confirm('Limpar todas as doses marcadas?')) return;
    setChecked(withHistoric({}));
  };

  // ─ Derived ─
  const { total: selTotal, done: selDone } = dayProgress(selDay);
  const selSchedule = SCHEDULE[selDay];
  const nextMed = nextDose ? MEDS[nextDose.slot.meds[0]] : null;

  const formatDate = (date) =>
    `${['dom','seg','ter','qua','qui','sex','sáb'][date.getDay()]}, ${date.getDate()} ${MONTHS[date.getMonth()]}`;

  // ─ Theme tokens ─
  const surface = dark ? 'rgba(255,248,236,0.04)' : 'rgba(255,255,255,0.65)';
  const textMain = dark ? '#FCF1DD' : '#1F1B16';
  const textMuted = dark ? 'rgba(252,241,221,0.50)' : 'rgba(31,27,22,0.50)';
  const dividerColor = dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

  return (
    <div
      className="min-h-screen transition-[background] duration-700"
      style={{
        color: textMain,
        fontFamily: "'Geist', system-ui, sans-serif",
        background: dark
          ? 'radial-gradient(ellipse at 20% 20%, rgba(243,134,58,0.10) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(197,122,230,0.10) 0%, transparent 50%), linear-gradient(180deg,#161310 0%,#1E1A14 100%)'
          : 'radial-gradient(ellipse at 30% 8%, #FFE0C2 0%, transparent 45%), radial-gradient(ellipse at 72% 92%, #FFD1DC 0%, transparent 45%), radial-gradient(ellipse at 55% 50%, #E8D5F5 0%, transparent 55%), #FFF6E8',
      }}
    >
      <div className="max-w-lg mx-auto px-4 pt-10 pb-28 safe-bottom">

        {/* ── Header ── */}
        <header className="flex items-start justify-between mb-8">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] mb-1"
               style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
              {greeting}
            </p>
            <h1 className="text-[2.6rem] leading-none m-0"
                style={{ fontFamily: "'Instrument Serif',serif", fontStyle: 'italic' }}>
              Remédios.
            </h1>
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={() => setShowNotifSheet(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: surface, backdropFilter: 'blur(8px)' }}>
              <Bell size={15} style={{ color: textMuted }} />
            </button>
            <button
              onClick={() => setDark(d => !d)}
              className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-transform"
              style={{ background: surface, backdropFilter: 'blur(8px)' }}>
              {dark ? <Sun size={15} style={{ color: textMuted }} /> : <Moon size={15} style={{ color: textMuted }} />}
            </button>
          </div>
        </header>

        {/* ── Settings drawer ── */}
        {showSettings && (
          <div className="rounded-[28px] p-5 mb-5 flex flex-col gap-4"
               style={{ background: surface, backdropFilter: 'blur(12px)' }}>
            <p className="text-[10px] uppercase tracking-[0.22em]"
               style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
              configurações
            </p>
            <button onClick={exportJSON}
              className="flex items-center gap-2 text-sm font-medium active:scale-95 transition-transform"
              style={{ color: textMain }}>
              <Download size={14} style={{ color: textMuted }} /> Exportar backup (JSON)
            </button>
            <button onClick={resetAll}
              className="flex items-center gap-2 text-sm font-medium active:scale-95 transition-transform"
              style={{ color: '#F08FA0' }}>
              <Trash2 size={14} /> Resetar tudo
            </button>
          </div>
        )}

        {/* ── Day Strip ── */}
        <div className="flex gap-1.5 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {SCHEDULE.map((day, i) => {
            const { total, done } = dayProgress(i);
            const isToday = i === todayIdx;
            const isSel = i === selDay;
            const isComplete = total > 0 && done === total;

            return (
              <button
                key={i}
                onClick={() => setSelDay(i)}
                className="flex-shrink-0 flex flex-col items-center gap-1 w-[38px] py-2 rounded-3xl active:scale-95 transition-all"
                style={{
                  background: isSel ? (dark ? 'rgba(252,241,221,0.10)' : 'rgba(31,27,22,0.07)') : 'transparent',
                }}>
                <span className="text-[9px] uppercase tracking-wider"
                      style={{ fontFamily: "'Geist Mono',monospace", color: isSel ? textMain : textMuted }}>
                  {DOW_I[day.date.getDay()]}
                </span>
                <span className="text-base leading-none"
                      style={{ fontFamily: "'Instrument Serif',serif", color: isSel ? textMain : textMuted }}>
                  {day.date.getDate()}
                </span>
                <div className="w-1.5 h-1.5 rounded-full"
                     style={{
                       background: isComplete ? '#7BCFA0' : isToday ? '#F39A55' : 'transparent',
                     }} />
              </button>
            );
          })}
        </div>

        {/* ── Hero: Next Dose ── */}
        {nextDose && selDay === todayIdx && (
          <div className="relative overflow-hidden rounded-[40px] p-6 mb-5"
               style={{
                 background: surface,
                 backdropFilter: 'blur(16px)',
                 boxShadow: nextMed ? `0 0 64px 0 ${nextMed.g1}50` : undefined,
               }}>
            {nextMed && (
              <div className="absolute inset-0 pointer-events-none"
                   style={{
                     background: `radial-gradient(ellipse at 75% 25%, ${nextMed.g1}35 0%, transparent 55%)`,
                   }} />
            )}
            <div className="relative">
              <p className="text-[10px] uppercase tracking-[0.22em] mb-1"
                 style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
                próxima dose
              </p>
              <div className="text-[4.5rem] leading-none mb-3"
                   style={{ fontFamily: "'Instrument Serif',serif" }}>
                {nextDose.slot.time}
              </div>
              <div className="flex flex-wrap gap-2 mb-5">
                {nextDose.slot.meds.map(mk => {
                  const m = MEDS[mk];
                  return (
                    <span key={mk} className="text-xs px-3 py-1 rounded-full font-medium"
                          style={{ background: `linear-gradient(135deg,${m.g1},${m.g2})`, color: m.ink }}>
                      {m.name}
                    </span>
                  );
                })}
              </div>
              <button
                onClick={() => scrollToSlot(nextDose.d, nextDose.s)}
                className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-medium active:scale-95 transition-transform"
                style={{ background: dark ? '#FCF1DD' : '#1F1B16', color: dark ? '#1F1B16' : '#FFF8EC' }}>
                Ir para {nextDose.slot.time} <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* ── Day Header ── */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => setSelDay(d => Math.max(0, d - 1))}
            disabled={selDay === 0}
            className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-25 active:scale-95 transition-transform flex-shrink-0"
            style={{ color: textMain }}>
            <ChevronLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] uppercase tracking-[0.22em]"
                    style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
                dia {selDay + 1}/11
              </span>
              <div className="flex items-center gap-2">
                <span className="text-[10px]"
                      style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
                  {selDone}/{selTotal}
                </span>
                {selDay !== todayIdx && (
                  <button onClick={() => setSelDay(todayIdx)}
                          className="text-[10px] active:opacity-60 transition-opacity"
                          style={{ color: '#F39A55', fontFamily: "'Geist Mono',monospace" }}>
                    hoje →
                  </button>
                )}
              </div>
            </div>

            {/* Progress bars — one per non-historic slot */}
            <div className="flex gap-1 mb-2">
              {selSchedule.slots.filter(s => !s.historic).map((slot, i) => {
                const si = selSchedule.slots.indexOf(slot);
                const done = slotDone(selDay, si);
                return (
                  <div key={i} className="flex-1 h-1 rounded-full overflow-hidden"
                       style={{ background: dividerColor }}>
                    {done && (
                      <div className="w-full h-full"
                           style={{ background: 'linear-gradient(90deg,#F3863A,#C57AE6)' }} />
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-sm" style={{ color: textMuted }}>
              {formatDate(selSchedule.date)}
            </p>
          </div>

          <button
            onClick={() => setSelDay(d => Math.min(TOTAL_DAYS - 1, d + 1))}
            disabled={selDay === TOTAL_DAYS - 1}
            className="w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-25 active:scale-95 transition-transform flex-shrink-0"
            style={{ color: textMain }}>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Timeline ── */}
        <div className="relative">
          <div className="absolute left-[60px] top-0 bottom-0 w-px"
               style={{ background: dividerColor }} />

          <div className="flex flex-col gap-3">
            {selSchedule.slots.map((slot, si) => {
              const isHistoric = slot.historic;
              const done = slotDone(selDay, si);
              const isNext = nextDose?.d === selDay && nextDose?.s === si;
              const firstMed = MEDS[slot.meds[0]];

              return (
                <div key={si} id={`slot-${selDay}-${si}`} className="flex gap-4">
                  {/* Time + bullet column */}
                  <div className="flex flex-col items-center w-[60px] flex-shrink-0 pt-4">
                    <span className="text-sm leading-none mb-2.5 tabular-nums"
                          style={{ fontFamily: "'Instrument Serif',serif", color: done ? textMuted : textMain }}>
                      {slot.time}
                    </span>
                    <div className="relative w-3 h-3 rounded-full flex items-center justify-center"
                         style={{
                           background: done
                             ? '#7BCFA0'
                             : isNext
                               ? `linear-gradient(135deg,${firstMed.g1},${firstMed.g2})`
                               : 'transparent',
                           border: !done && !isNext ? `2px solid ${dividerColor}` : 'none',
                           boxShadow: isNext ? `0 0 10px 0 ${firstMed.g1}90` : undefined,
                         }}>
                      {done && <Check size={7} color="#fff" strokeWidth={3} />}
                      {isNext && (
                        <div className="absolute inset-0 rounded-full animate-ping"
                             style={{ background: `${firstMed.g1}60`, animationDuration: '1.4s' }} />
                      )}
                    </div>
                  </div>

                  {/* Card */}
                  <div className="flex-1 rounded-[36px] p-4 mb-1"
                       style={{
                         backdropFilter: 'blur(8px)',
                         background: isNext
                           ? `linear-gradient(135deg,${firstMed.g1}18,${firstMed.g2}10),${surface}`
                           : surface,
                         outline: isNext ? `1px solid ${firstMed.g1}60` : 'none',
                         boxShadow: isNext ? `0 4px 28px 0 ${firstMed.g1}35` : undefined,
                       }}>
                    {isHistoric && (
                      <p className="text-[9px] uppercase tracking-[0.2em] mb-2"
                         style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
                        histórico
                      </p>
                    )}

                    <div className="flex flex-col gap-2.5">
                      {slot.meds.map(mk => {
                        const med = MEDS[mk];
                        const key = `${selDay}-${si}-${mk}`;
                        const isChecked = !!checked[key];

                        return (
                          <div key={mk}
                               className="flex items-center gap-3 cursor-pointer"
                               onClick={() => !isHistoric && toggleMed(selDay, si, mk)}>

                            {/* Checkbox */}
                            <div className="relative w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 active:scale-90 transition-transform"
                                 style={{
                                   background: isChecked
                                     ? `linear-gradient(135deg,${med.g1},${med.g2})`
                                     : dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                                   boxShadow: isChecked ? `0 0 10px 0 ${med.g1}90` : undefined,
                                   cursor: isHistoric ? 'default' : 'pointer',
                                 }}>
                              {isChecked && <Check size={11} color="#fff" strokeWidth={2.5} />}
                              {pulsing === key && (
                                <div className="med-pulse-ring absolute inset-0 rounded-full pointer-events-none"
                                     style={{ background: med.g1 }} />
                              )}
                            </div>

                            {/* Med label */}
                            <div className="flex-1 flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium"
                                    style={{
                                      textDecoration: isChecked ? 'line-through' : 'none',
                                      opacity: isChecked ? 0.45 : 1,
                                      transition: 'opacity 0.2s',
                                    }}>
                                {med.name}
                              </span>
                              <span className="text-xs flex-shrink-0" style={{ color: textMuted }}>
                                {med.dose}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Legend ── */}
        <div className="mt-6 rounded-[28px] p-5"
             style={{ background: surface, backdropFilter: 'blur(8px)' }}>
          <p className="text-[10px] uppercase tracking-[0.22em] mb-4"
             style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
            tratamento
          </p>
          <div className="flex flex-col gap-3">
            {MED_ORDER.map(mk => {
              const med = MEDS[mk];
              return (
                <div key={mk} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                       style={{ background: `linear-gradient(135deg,${med.g1},${med.g2})` }} />
                  <span className="text-sm font-medium flex-1">{med.name}</span>
                  <span className="text-xs" style={{ color: textMuted }}>{med.dose}</span>
                  <span className="text-[10px]"
                        style={{ fontFamily: "'Geist Mono',monospace", color: textMuted }}>
                    {med.freq}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Notifications Sheet ── */}
      <NotifSheet open={showNotifSheet} onClose={() => setShowNotifSheet(false)} dark={dark} />

      {/* ── Toast ── */}
      {toast && (
        <div className="toast-enter fixed bottom-8 left-1/2 z-50 pointer-events-none"
             style={{ transform: 'translateX(-50%)' }}>
          <div className="flex items-center gap-2 px-5 py-3 rounded-full text-sm font-semibold shadow-lg"
               style={{ background: '#7BCFA0', color: '#1F6B40' }}>
            <Check size={14} strokeWidth={2.5} /> dia completo
          </div>
        </div>
      )}
    </div>
  );
}
