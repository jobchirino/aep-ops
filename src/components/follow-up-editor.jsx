'use client';

// src/components/follow-up-editor.jsx
import { useState, useTransition } from 'react';
import { Check, LoaderCircle, Save } from 'lucide-react';
import { setFollowUpDateAction } from '@/app/actions/caseDetailActions';

const inputClasses =
  'rounded-xl border border-zinc-300 bg-white px-2 py-1.5 text-xs text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

export default function FollowUpEditor({ caseId, initialDate, initialTime }) {
  const [date, setDate] = useState(initialDate || '');
  const [time, setTime] = useState(initialTime || '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    setError('');
    setSaved(false);

    startTransition(async () => {
      const result = await setFollowUpDateAction(caseId, date, time);

      if (!result?.ok) {
        setError(result?.error || 'No se pudo guardar el seguimiento.');
        return;
      }

      setDate(result.date || '');
      setTime(result.time || '');
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1">
      <div className="flex items-center gap-1">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          aria-label="Fecha de seguimiento en hora de New Jersey"
          className={`${inputClasses} w-[135px]`}
        />
        <input
          type="time"
          value={time}
          onChange={(event) => setTime(event.target.value)}
          aria-label="Hora de seguimiento en hora de New Jersey"
          className={`${inputClasses} w-[100px]`}
        />
        <button
          type="submit"
          disabled={pending}
          title="Guardar seguimiento (hora ET)"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {pending ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : saved ? (
            <Check className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      <span className="text-[9px] text-zinc-400 dark:text-zinc-500">Hora New Jersey (ET)</span>

      {error ? (
        <span className="text-[9px] font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : null}
    </form>
  );
}
