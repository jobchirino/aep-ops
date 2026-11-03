'use client';

// src/app/(app)/cases/[id]/note-composer.jsx
import { useState, useTransition } from 'react';
import {
  AlertCircle,
  CalendarClock,
  Check,
  ClipboardCheck,
  LoaderCircle,
  PhoneCall,
  Scale,
  Send,
} from 'lucide-react';
import { logNcSmsAction } from '@/app/actions/caseActions';
import { addTimelineNoteAction, logQuickNoteAction } from '@/app/actions/caseDetailActions';
import { copyTextToClipboard } from '@/lib/clipboard';

const QUICK_BUTTONS = [
  {
    key: 'nc_sms',
    label: '📞 NC + SMS',
    Icon: PhoneCall,
    className:
      'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20',
  },
  {
    key: 'call_later',
    label: 'Pide llamar luego',
    Icon: CalendarClock,
    className:
      'border-sky-200 bg-sky-50 text-sky-700 hover:border-sky-300 hover:bg-sky-100 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-300 dark:hover:bg-sky-500/20',
  },
  {
    key: 'comparing',
    label: 'Comparando planes',
    Icon: Scale,
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20',
  },
];

export default function NoteComposer({ caseId }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [isPending, startTransition] = useTransition();

  function showCopiedFeedback(note, copied) {
    setFeedback({ type: copied ? 'copied' : 'manual', note });
    window.setTimeout(() => setFeedback(null), 6000);
  }

  function runQuickAction(key) {
    setError('');
    setFeedback(null);
    setBusy(key);

    startTransition(async () => {
      const result =
        key === 'nc_sms'
          ? await logNcSmsAction(caseId)
          : await logQuickNoteAction(caseId, key);

      setBusy('');

      if (!result?.ok) {
        setError(result?.error || 'No se pudo registrar la acción.');
        return;
      }

      const copied = await copyTextToClipboard(result.note);
      showCopiedFeedback(result.note, copied);
    });
  }

  function submitManualNote() {
    const content = text.trim();

    if (!content) {
      setError('Escribe una nota antes de guardar.');
      return;
    }

    setError('');
    setFeedback(null);
    setBusy('manual');

    startTransition(async () => {
      const result = await addTimelineNoteAction(caseId, content);

      setBusy('');

      if (!result?.ok) {
        setError(result?.error || 'No se pudo guardar la nota.');
        return;
      }

      setText('');
      const copied = await copyTextToClipboard(result.note);
      showCopiedFeedback(result.note, copied);
    });
  }

  function handleKeyDown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      submitManualNote();
    }
  }

  const disabled = isPending || Boolean(busy);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Nueva nota</h2>
      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
        Se firma automáticamente con tu usuario y se copia la nota para Radius.
      </p>

      <textarea
        rows={3}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Escribe lo que pasó en la llamada… (Ctrl/Cmd + Enter para guardar)"
        className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />

      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-3">
        {QUICK_BUTTONS.map(({ key, label, Icon, className }) => (
          <button
            key={key}
            type="button"
            onClick={() => runQuickAction(key)}
            disabled={disabled}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-[11px] font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
          >
            {busy === key ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5" />
            )}
            {label}
          </button>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {text.length}/4000
        </span>

        <button
          type="button"
          onClick={submitManualNote}
          disabled={disabled || text.trim().length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {busy === 'manual' ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Guardar nota
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-2 flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {feedback?.type === 'copied' ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <ClipboardCheck className="h-3.5 w-3.5" />
          Nota copiada para Radius. Pégala en el perfil del cliente.
        </p>
      ) : null}

      {feedback?.type === 'manual' ? (
        <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-300">
            <Check className="h-3.5 w-3.5" />
            Nota guardada. El navegador bloqueó el portapapeles; copia manualmente:
          </p>
          <textarea
            readOnly
            rows={2}
            value={feedback.note}
            className="mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 font-mono text-[10px] text-amber-900 dark:border-amber-500/30 dark:bg-zinc-900 dark:text-amber-200"
          />
        </div>
      ) : null}
    </section>
  );
}
