import { useState, useEffect } from 'react';
import { Bell, BellOff, X, Smartphone, CheckCircle, AlertCircle } from 'lucide-react';
import { isPushSupported, isInstalledPWA, getPushPermission, subscribePush, unsubscribePush } from '../lib/push';

export default function NotifSheet({ open, onClose, dark }) {
  const [status, setStatus] = useState('idle'); // idle | requesting | granted | denied | unsupported | not-pwa
  const [subscribed, setSubscribed] = useState(false);

  const surface = dark ? 'rgba(30,26,20,0.98)' : 'rgba(255,252,245,0.98)';
  const textMain = dark ? '#FCF1DD' : '#1F1B16';
  const textMuted = dark ? 'rgba(252,241,221,0.55)' : 'rgba(31,27,22,0.50)';
  const divider = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)';

  useEffect(() => {
    if (!open) return;
    if (!isPushSupported()) { setStatus('unsupported'); return; }
    if (!isInstalledPWA()) { setStatus('not-pwa'); return; }
    getPushPermission().then((perm) => {
      if (perm === 'granted') setStatus('granted');
      else if (perm === 'denied') setStatus('denied');
      else setStatus('idle');
    });
    // Check existing subscription
    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    );
  }, [open]);

  const handleActivate = async () => {
    setStatus('requesting');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setStatus('denied'); return; }
      await subscribePush();
      setSubscribed(true);
      setStatus('granted');
    } catch (e) {
      setStatus('idle');
      console.error(e);
    }
  };

  const handleDeactivate = async () => {
    await unsubscribePush();
    setSubscribed(false);
    setStatus('idle');
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-[32px] px-6 pt-5 pb-10 max-w-lg mx-auto"
        style={{ background: surface, boxShadow: '0 -8px 40px rgba(0,0,0,0.25)' }}>

        {/* Handle */}
        <div className="w-10 h-1 rounded-full mx-auto mb-5"
             style={{ background: divider }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold" style={{ fontFamily: "'Instrument Serif',serif", color: textMain }}>
              Lembretes
            </h2>
            <p className="text-xs mt-0.5" style={{ color: textMuted, fontFamily: "'Geist Mono',monospace", textTransform: 'uppercase', letterSpacing: '0.18em' }}>
              notificações de dose
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
            style={{ background: divider }}>
            <X size={14} style={{ color: textMuted }} />
          </button>
        </div>

        {/* Content by status */}
        {status === 'unsupported' && (
          <StatusBlock icon={<AlertCircle size={20} color="#F08FA0" />}
            title="Não suportado"
            body="Seu navegador não suporta notificações push. Tente o Chrome no Android."
            textMain={textMain} textMuted={textMuted} />
        )}

        {status === 'not-pwa' && (
          <div>
            <StatusBlock icon={<Smartphone size={20} color="#F39A55" />}
              title="Instale o app primeiro"
              body="No iPhone, o app precisa estar instalado para receber notificações."
              textMain={textMain} textMuted={textMuted} />
            <ol className="mt-4 space-y-2.5">
              {[
                'Toque no ícone de compartilhamento (□↑) no Safari',
                'Role e toque em "Adicionar à Tela de Início"',
                'Toque em "Adicionar"',
                'Abra o app pela tela de início e volte aqui',
              ].map((step, i) => (
                <li key={i} className="flex gap-3 text-sm" style={{ color: textMain }}>
                  <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold"
                        style={{ background: '#F39A55', color: '#fff', marginTop: 1 }}>
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        )}

        {status === 'denied' && (
          <StatusBlock icon={<BellOff size={20} color="#F08FA0" />}
            title="Permissão bloqueada"
            body="Ative as notificações em: Configurações → Safari → Notificações → Remédios → Permitir."
            textMain={textMain} textMuted={textMuted} />
        )}

        {status === 'granted' && subscribed && (
          <>
            <StatusBlock icon={<CheckCircle size={20} color="#7BCFA0" />}
              title="Lembretes ativos"
              body="Você vai receber uma notificação em cada horário de dose, mesmo com o app fechado."
              textMain={textMain} textMuted={textMuted} />
            <button
              onClick={handleDeactivate}
              className="mt-5 w-full py-3 rounded-full text-sm font-medium active:scale-95 transition-transform"
              style={{ background: divider, color: textMuted }}>
              Desativar lembretes
            </button>
          </>
        )}

        {(status === 'idle' || (status === 'granted' && !subscribed)) && (
          <>
            <StatusBlock icon={<Bell size={20} color="#F39A55" />}
              title="Ative os lembretes"
              body="Receba uma notificação em cada horário de dose, mesmo com o app fechado."
              textMain={textMain} textMuted={textMuted} />
            <button
              onClick={handleActivate}
              className="mt-5 w-full py-3.5 rounded-full text-sm font-semibold active:scale-95 transition-transform"
              style={{ background: dark ? '#FCF1DD' : '#1F1B16', color: dark ? '#1F1B16' : '#FFF8EC' }}>
              Ativar lembretes
            </button>
          </>
        )}

        {status === 'requesting' && (
          <div className="text-center py-4 text-sm" style={{ color: textMuted }}>
            Aguardando permissão…
          </div>
        )}
      </div>
    </>
  );
}

function StatusBlock({ icon, title, body, textMain, textMuted }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-semibold mb-1" style={{ color: textMain }}>{title}</p>
        <p className="text-sm leading-relaxed" style={{ color: textMuted }}>{body}</p>
      </div>
    </div>
  );
}
