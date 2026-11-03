'use client';

// src/components/agent-select.jsx
import { useOptimistic, useState, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { assignCaseAction } from '@/app/actions/caseDetailActions';
import { cn } from '@/lib/utils';

export default function AgentSelect({
  caseId,
  assignedToId,
  agents,
  compact = false,
  className,
}) {
  const [optimisticId, setOptimisticId] = useOptimistic(assignedToId || '');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');

  function handleChange(event) {
    const nextId = event.target.value;

    setError('');

    startTransition(async () => {
      setOptimisticId(nextId);

      const result = await assignCaseAction(caseId, nextId || null);

      if (!result?.ok) {
        setError(result?.error || 'No se pudo cambiar el agente.');
      }
    });
  }

  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1">
        <select
          aria-label="Agente asignado"
          value={optimisticId}
          onChange={handleChange}
          disabled={pending}
          title={error || 'Cambiar agente asignado'}
          className={cn(
            'min-w-0 border bg-white text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-200',
            compact
              ? 'w-full max-w-[150px] rounded-lg border-zinc-200 px-2 py-1 text-[11px] dark:border-zinc-700'
              : 'rounded-xl border-zinc-300 px-2.5 py-1.5 text-xs dark:border-zinc-700',
            error ? 'border-red-300 dark:border-red-500/50' : ''
          )}
        >
          <option value="">Sin asignar</option>
          {agents.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agent.name}
            </option>
          ))}
        </select>

        {pending ? (
          <LoaderCircle className="h-3 w-3 shrink-0 animate-spin text-sky-500" />
        ) : null}
      </div>

      {error ? (
        <p className="mt-0.5 text-[9px] font-medium text-red-600 dark:text-red-400">{error}</p>
      ) : null}
    </div>
  );
}
