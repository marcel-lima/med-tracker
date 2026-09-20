import { useState } from 'react';
import { X } from 'lucide-react';

const TEXT_SCALES = [
  { label: 'normal', value: 1 },
  { label: 'maior', value: 1.25 },
  { label: 'grande', value: 1.5 },
];

/**
 * Per-device settings: the person's name (shows in the greeting and in
 * "dado · nome") and the text size. Both live only on this phone.
 */
export default function DeviceSheet({ open, onClose, name, onChangeName, textScale, onChangeTextScale }) {
  const [draft, setDraft] = useState(name);
  if (!open) return null;

  const save = () => { onChangeName(draft.trim().slice(0, 40)); onClose(); };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="bottom-sheet max-w-lg mx-auto">
        <div className="w-10 h-1 rounded-full mx-auto mb-5" style={{ background: 'var(--line)' }} />
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="eyebrow">este aparelho</p>
            <h2 className="text-xl font-semibold tracking-tight">Você</h2>
          </div>
          <button onClick={onClose} className="icon-btn" aria-label="Fechar"><X size={14} /></button>
        </div>

        <label className="block mb-5">
          <span className="eyebrow block mb-2">seu nome</span>
          <input id="device-name" className="input w-full" placeholder="ex.: Marcia" value={draft} autoFocus
                 onChange={e => setDraft(e.target.value)}
                 onKeyDown={e => { if (e.key === 'Enter') save(); }} />
          <span className="block text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Aparece na saudação e em "dado · nome" quando você marca uma dose.
          </span>
        </label>

        <div className="mb-6">
          <span className="eyebrow block mb-2">tamanho do texto</span>
          <div className="flex flex-wrap gap-1.5">
            {TEXT_SCALES.map(t => (
              <button key={t.value} onClick={() => onChangeTextScale(t.value)}
                      className={`chip ${textScale === t.value ? 'chip-on' : ''}`}>{t.label}</button>
            ))}
          </div>
          <span className="block text-xs mt-2" style={{ color: 'var(--muted)' }}>
            Só neste aparelho. Muda na hora, para você conferir. Em Android já começa em "maior".
          </span>
        </div>

        <button onClick={save} className="btn btn-primary w-full">Salvar</button>
      </div>
    </>
  );
}
