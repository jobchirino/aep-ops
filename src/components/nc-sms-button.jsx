'use client';

// src/components/nc-sms-button.jsx
import { useState, useTransition } from 'react';
import { AlertCircle, Check, ClipboardCheck, LoaderCircle } from 'lucide-react';
import { logNcSmsAction } from '@/app/actions/caseActions';
import { copyTextToClipboard } from '@/lib/clipboard';

export default function NcSmsButton({ caseId }) {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState(null);

  function handleClick() {
    setFeedback(null);

    startTransition(async () => {
      const result = await logNcSmsAction(caseId);

      if (!result?.ok) {
        setFeedback('error');
        return;
      }

      const copied = await copyTextToClipboard(result.note);
      setFeedback(copied ? 'copied' : 'saved');

      window.setTimeout(() => setFeedback(null), 3000);
    });
  }

  let label = '📞 NC + SMS';
  let className =
    'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20';
  let icon = null;

  if (pending) {
    label = 'Registrando…';
    icon = <LoaderCircle className="h-3.5 w-3.5 animate-spin" />;
  } else if (feedback === 'copied') {
    label = 'Nota copiada';
    icon = <ClipboardCheck className="h-3.5 w-3.5" />;
    className =
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  } else if (feedback === 'saved') {
    label = 'Registrado';
    icon = <Check className="h-3.5 w-3.5" />;
    className =
      'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300';
  } else if (feedback === 'error') {
    label = 'No se pudo';
    icon = <AlertCircle className="h-3.5 w-3.5" />;
    className =
      'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300';
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      title="Registra la llamada no contestada + SMS/Voicemail, pasa el caso a En seguimiento y copia la nota para RadiusBob."
      className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-2.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {icon}
      {label}
    </button>
  );
}
