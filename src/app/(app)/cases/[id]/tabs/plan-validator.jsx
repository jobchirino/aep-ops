'use client';

// src/app/(app)/cases/[id]/tabs/plan-validator.jsx
import { useCallback, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  LoaderCircle,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { searchNonCommissionablePlanAction } from '@/app/actions/caseDetailActions';
import { NON_COMMISSIONABLE_PLAN_YEAR } from '@/lib/business-rules';

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-9 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export default function PlanValidator({ initialQuery, clientState, targetPlanName }) {
  const [query, setQuery] = useState(initialQuery || '');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const runSearch = useCallback(
    async (value) => {
      const searchTerm = String(value || '').trim();

      if (searchTerm.length < 2) {
        setError('Escribe al menos 2 caracteres para buscar.');
        return;
      }

      setLoading(true);
      setError('');

      const response = await searchNonCommissionablePlanAction(searchTerm, clientState);

      setLoading(false);

      if (!response?.ok) {
        setError(response?.error || 'No se pudo validar el plan.');
        setResult(null);
        return;
      }

      setResult(response);
    },
    [clientState]
  );

  function handleSubmit(event) {
    event.preventDefault();
    runSearch(query);
  }

  const stateLabel = clientState || 'sin estado registrado';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Validador de planes no comisionables
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Busca por código (ej. H5521-419), nombre o aseguradora. Se compara contra el catálogo{' '}
          <strong>{NON_COMMISSIONABLE_PLAN_YEAR}</strong> y el estado del cliente:{' '}
          <strong>{stateLabel}</strong>. Los años anteriores son solo histórico y no cuentan.
        </p>
        {targetPlanName ? (
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            Estrategia actual del caso: <span className="font-medium">{targetPlanName}</span>
          </p>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="H5521-419, Clover, Humana…"
            aria-label="Buscar plan no comisionable"
            className={inputClasses}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {loading ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5" />
          )}
          Validar plan
        </button>
      </form>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!result && !loading && !error ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-8 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <ShieldAlert className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Valida el plan antes de confirmar la estrategia
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Si el plan aparece para {NON_COMMISSIONABLE_PLAN_YEAR} en {stateLabel}, verás una
            alerta roja.
          </p>
        </div>
      ) : null}

      {result?.hasStateMatch ? (
        <div className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-sm dark:border-red-500/40 dark:bg-red-500/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-7 w-7 shrink-0 text-red-600 dark:text-red-400" />
            <div>
              <p className="text-base font-bold text-red-700 dark:text-red-300">
                ⚠️ PLAN NO COMISIONABLE
              </p>
              <p className="mt-1 text-xs text-red-700/90 dark:text-red-300/90">
                El plan coincide con {result.stateMatches.length} registro
                {result.stateMatches.length === 1 ? '' : 's'} del catálogo{' '}
                {NON_COMMISSIONABLE_PLAN_YEAR} para{' '}
                <strong>{result.state || 'todos los estados'}</strong>.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {result && !result.hasStateMatch ? (
        result.otherStates?.length > 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-semibold">
              Existe en el catálogo {NON_COMMISSIONABLE_PLAN_YEAR}, pero para otro estado.
            </p>
            <p className="mt-0.5">
              No figura para {stateLabel} en el catálogo {NON_COMMISSIONABLE_PLAN_YEAR}. Aparece
              en: {result.otherStates.join(', ')}.
            </p>
          </div>
        ) : (
          <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">
                No figura en el catálogo {NON_COMMISSIONABLE_PLAN_YEAR} para {stateLabel}.
              </p>
              <p className="mt-0.5 opacity-90">
                Verifica igualmente el plan antes de confirmar la estrategia.
              </p>
            </div>
          </div>
        )
      ) : null}

      {result && result.stateMatches.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <th className="px-3 py-2">Plan</th>
                <th className="px-3 py-2">Carrier</th>
                <th className="px-3 py-2">Año</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Nota</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {result.stateMatches.map((match) => (
                <tr key={match.id} className="align-top">
                  <td className="px-3 py-2">
                    <p className="font-medium text-zinc-800 dark:text-zinc-100">
                      {match.planName || '—'}
                    </p>
                    <p className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      {match.planId}
                      {match.rawPlanId && match.rawPlanId !== match.planId
                        ? ` · ${match.rawPlanId}`
                        : ''}
                    </p>
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">{match.carrier}</td>
                  <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                    {match.year}
                  </td>
                  <td className="px-3 py-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                    {match.state}
                  </td>
                  <td className="px-3 py-2 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {match.statusNote || 'No comisionable'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {result && result.otherMatches?.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 opacity-80 dark:border-zinc-800">
          <p className="border-b border-zinc-200 bg-zinc-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
            Coincidencias en otros estados
          </p>
          <ul className="divide-y divide-zinc-100 text-xs dark:divide-zinc-800">
            {result.otherMatches.map((match) => (
              <li key={match.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="truncate text-zinc-700 dark:text-zinc-200">
                  {match.planName} · {match.carrier}
                </span>
                <span className="shrink-0 font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                  {match.state} · {match.year}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
