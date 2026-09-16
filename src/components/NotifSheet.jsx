import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Smartphone, CheckCircle, AlertCircle, Send, Clock } from 'lucide-react';
import { isPushSupported, isInstalledPWA, getPushPermission, subscribePush, unsubscribePush, ensureRegistered, registrationStatus } from '../lib/push';
import { sendTestPush, sendScheduledTest } from '../lib/api';

const OFFSETS = [
  { label: 'na hora', value: 0 },
  { label: '5 min antes', value: -5 },
  { label: '10 min antes', value: -10 },
  { label: '15 min antes', value: -15 },
];
const REPEATS = [
  { label: 'não', value: 0 },
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '1 h', value: 60 },
];

export default function NotifSheet({ open, onClose, reminders, onChangeReminders }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied | unsupported | not-pwa
  const [subscribed, setSubscribed] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [scheduling, setScheduling] = useState(false);

  const scheduledTest = async () => {
    setScheduling(true);
    setTestMsg(null);
    await refreshReg();
    const r = await sendScheduledTest();
    if (r?.ok) setTestMsg('Agendado. Feche o app e aguarde: em cerca de 1 minuto deve chegar "Teste agendado".');
    else setTestMsg(`Erro ao agendar: ${r?.error || 'sem resposta'}`);
    setScheduling(false);
  };
  const [reg, setReg] = useState(null); // { devices, registered } from the server
  const [activateErr, setActivateErr] = useState(null);

  const refreshReg = async () => {
    await ensureRegistered();
    setReg(await registrationStatus());
  };

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      if (!isPushSupported()) { if (alive) setStatus('unsupported'); return; }
      if (!isInstalledPWA()) { if (alive) setStatus('not-pwa'); return; }
      const perm = await getPushPermission();
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!alive) return;
      setSubscribed(!!sub);
      setStatus(perm === 'granted' ? 'granted' : perm === 'denied' ? 'denied' : 'idle');
      if (sub) { await ensureRegistered(); const st = await registrationStatus(); if (alive) setReg(st); }
    })();
    return () => { alive = false; };
  }, [open]);

  const activate = async () => {
    setStatus('requesting');
    setActivateErr(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }
      await subscribePush();
      setSubscribed(true);
      setStatus('granted');
      setReg(await registrationStatus());
    } catch (e) {
      console.error(e);
      setActivateErr(e.message || 'Não deu certo. Tente de novo.');
      setStatus('idle');
    }
  };

  const deactivate = async () => {
    await unsubscribePush();
    setSubscribed(false);
    setStatus('idle');
    setReg(null);
  };

  const test = async () => {
    setTesting(true);
    setTestMsg(null);
    const r = await sendTestPush();
    const s = r?.result;
    if (r?.ok && s) {
      if (s.total === 0) setTestMsg('O servidor não tem nenhum aparelho inscrito. Toque em Desativar e ative de novo.');
      else if (s.sent > 0) setTestMsg(`Enviado para ${s.sent} ${s.sent === 1 ? 'aparelho' : 'aparelhos'}. Deve chegar em alguns segundos.`);
      else setTestMsg('Nenhum aparelho recebeu. Toque em Desativar e ative de novo.');
    } else {
      setTestMsg(`Erro no servidor: ${r?.error || 'sem resposta'}${r?.detail ? ` (${JSON.stringify(r.detail)})` : ''}`);
    }
    setTesting(false);
  };

  if (!open) return null;
  const active = status === 'granted' && subscribed;

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="bottom-sheet max-w-lg mx-auto">
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--line)' }} />

        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="eyebrow">notificações</p>
            <h2 className="text-xl font-semibold tracking-tight">Lembretes</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fechar"><X size={14} /></button>
        </div>

        {status === 'unsupported' && (
          <Block icon={<AlertCircle size={20} color="#E5484D" />} title="Sem suporte"
                 body="Este navegador não recebe notificações push. No iPhone use o Safari; no Android, o Chrome." />
        )}

        {status === 'not-pwa' && (
          <div>
            <Block icon={<Smartphone size={20} color="#F5822B" />} title="Instale o app primeiro"
                   body="No iPhone, as notificações só chegam com o app na tela de início." />
            <ol className="mt-4 space-y-2.5">
              {['Toque em Compartilhar (□↑) no Safari', 'Toque em "Adicionar à Tela de Início"', 'Toque em "Adicionar"', 'Abra o app pelo ícone e volte aqui'].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[0.625rem] font-semibold"
                        style={{ background: 'var(--primary)', color: 'var(--primary-fg)', marginTop: 1 }}>{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {status === 'denied' && (
          <Block icon={<BellOff size={20} color="#E5484D" />} title="Permissão bloqueada"
                 body="Libere em Ajustes → Notificações → Remédios → Permitir." />
        )}

        {status === 'requesting' && (
          <p className="text-center py-4 text-sm" style={{ color: 'var(--muted)' }}>Aguardando permissão…</p>
        )}

        {(status === 'idle' || status === 'granted') && (
          <>
            {active ? (
              <Block icon={<CheckCircle size={20} color={reg && !reg.registered ? '#F5822B' : '#3DBF7A'} />} title="Lembretes ativos"
                     body={reg
                       ? (reg.registered
                          ? `Este aparelho está registrado. ${reg.devices} ${reg.devices === 1 ? 'aparelho recebe' : 'aparelhos recebem'} os avisos.`
                          : 'Este aparelho ainda não está registrado no servidor. Toque em Desativar e ative de novo.')
                       : 'Você recebe um aviso em cada dose, mesmo com o app fechado.'} />
            ) : (
              <Block icon={<Bell size={20} color="#F5822B" />} title="Ativar lembretes"
                     body={activateErr || 'Receba um aviso em cada dose, mesmo com o app fechado.'} />
            )}

            <div className="mt-6">
              <p className="eyebrow mb-2">avisar</p>
              <div className="flex flex-wrap gap-1.5">
                {OFFSETS.map(o => (
                  <button key={o.value} className={`chip ${reminders.offsetMin === o.value ? 'chip-on' : ''}`}
                          onClick={() => onChangeReminders({ ...reminders, offsetMin: o.value })}>{o.label}</button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <p className="eyebrow mb-2">repetir se eu não marcar</p>
              <div className="flex flex-wrap gap-1.5">
                {REPEATS.map(r => (
                  <button key={r.value} className={`chip ${reminders.repeatMin === r.value ? 'chip-on' : ''}`}
                          onClick={() => onChangeReminders({ ...reminders, repeatMin: r.value })}>{r.label}</button>
                ))}
              </div>
            </div>

            {active ? (
              <>
                <div className="flex gap-2 mt-6">
                  <button onClick={deactivate} className="btn flex-1" style={{ color: 'var(--muted)' }}>Desativar</button>
                  <button onClick={async () => { await refreshReg(); await test(); }} className="btn flex-1" disabled={testing}>
                    <Send size={14} /> {testing ? 'Enviando…' : 'Testar'}
                  </button>
                </div>
                <button onClick={scheduledTest} className="btn w-full mt-2" disabled={scheduling}>
                  <Clock size={14} /> {scheduling ? 'Agendando…' : 'Testar em 1 min (pelo agendador)'}
                </button>
                {testMsg && (
                  <p className="text-xs mt-3 leading-relaxed" style={{ color: testMsg.startsWith('Enviado') ? 'var(--muted)' : '#E5484D' }}>{testMsg}</p>
                )}
              </>
            ) : (
              <button onClick={activate} className="btn btn-primary w-full mt-6">Ativar lembretes</button>
            )}
          </>
        )}
      </div>
    </>
  );
}

function Block({ icon, title, body }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold mb-1">{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>{body}</p>
      </div>
    </div>
  );
}
