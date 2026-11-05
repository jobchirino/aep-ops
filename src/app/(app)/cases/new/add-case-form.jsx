'use client';

// src/app/(app)/cases/new/add-case-form.jsx
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, LoaderCircle, Plus } from 'lucide-react';
import { createCaseForClientAction } from '@/app/actions/caseCreateActions';
import { CASE_CATEGORIES } from '@/lib/case-categories';

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export default function AddCaseForm({ clientId, clientName, agents, currentUserId }) {
  const router = useRouter();
  const [category, setCategory] = useState('ENTRANTE');
  const [assignedToId, setAssignedToId] = useState(currentUserId);
  const [currentCarrier, setCurrentCarrier] = useState('');
  const [currentPlanName, setCurrentPlanName] = useState('');
  const [currentPlanId, setCurrentPlanId] = useState('');
  const [error, setError] = useState('');
  const [existingCaseId, setExistingCaseId] = useState('');
  const [pending, startTransition] = useTransition();

  function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setExistingCaseId('');

    startTransition(async () => {
      const result = await createCaseForClientAction({
        clientId,
        category,
        assignedToId,
        currentCarrier,
        currentPlanName,
        currentPlanId,
      });

      if (!result?.ok) {
        setError(result?.error || 'No se pudo crear el caso.');
        setExistingCaseId(result?.existingCaseId || '');
        return;
      }

      router.push(`/cases/${result.caseId}`);
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 space-y-2 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        Agregar {clientName} al AEP
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Categoría
          </span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className={inputClasses}
          >
            {CASE_CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Agente
          </span>
          <select
            value={assignedToId}
            onChange={(event) => setAssignedToId(event.target.value)}
            className={inputClasses}
          >
            <option value="">Sin asignar</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <details className="rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
        <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          Plan actual (opcional)
        </summary>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <input
            type="text"
            value={currentCarrier}
            onChange={(event) => setCurrentCarrier(event.target.value)}
            placeholder="Aseguradora"
            aria-label="Aseguradora actual"
            className={inputClasses}
          />
          <input
            type="text"
            value={currentPlanName}
            onChange={(event) => setCurrentPlanName(event.target.value)}
            placeholder="Nombre del plan"
            aria-label="Nombre del plan actual"
            className={inputClasses}
          />
          <input
            type="text"
            value={currentPlanId}
            onChange={(event) => setCurrentPlanId(event.target.value)}
            placeholder="Plan ID (ej. H5521-392)"
            aria-label="Plan ID actual"
            className={inputClasses}
          />
        </div>
      </details>

      {error ? (
        <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2 py-1.5 text-[11px] text-red-700 dark:bg-red-500/10 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {error}
            {existingCaseId ? (
              <>
                {' '}
                <Link
                  href={`/cases/${existingCaseId}`}
                  className="font-semibold underline underline-offset-2"
                >
                  Abrir caso existente
                </Link>
              </>
            ) : null}
          </span>
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Plus className="h-3.5 w-3.5" />
        )}
        Agregar al AEP
      </button>
    </form>
  );
}
