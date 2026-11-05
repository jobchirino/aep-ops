'use client';

// src/app/(app)/cases/[id]/case-header.jsx
import { useOptimistic, useState, useTransition } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  ExternalLink,
  LoaderCircle,
  PhoneCall,
  Unlock,
  UserRound,
} from 'lucide-react';
import {
  toggleInCallAction,
  updateCategoryAction,
  updateStageAction,
} from '@/app/actions/caseDetailActions';
import { CASE_STAGES } from '@/lib/case-stages';
import { CASE_CATEGORIES } from '@/lib/case-categories';
import AgentSelect from '@/components/agent-select';
import FollowUpEditor from '@/components/follow-up-editor';

const CATEGORY_STYLES = {
  NO_RENOVABLE: {
    label: 'No renovable',
    className:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  },
  NO_COMISIONABLE: {
    label: 'No comisionable',
    className:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  CANCELADO: {
    label: 'Cancelado',
    className:
      'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  },
  ENTRANTE: {
    label: 'Entrante / Cambio de plan',
    className:
      'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30',
  },
};

const selectClasses =
  'rounded-xl border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

function fullAddress(client) {
  return [client.address, client.city, client.state, client.zip].filter(Boolean).join(', ');
}

export default function CaseHeader({ aepCase, client, currentUser, agents }) {
  const serverLock = {
    id: aepCase.lockedByUser?.id || null,
    name: aepCase.lockedByUser?.name || '',
  };

  const [stage, setOptimisticStage] = useOptimistic(aepCase.stage);
  const [categoryValue, setOptimisticCategory] = useOptimistic(aepCase.category);
  const [lock, setOptimisticLock] = useOptimistic(serverLock);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pending, startTransition] = useTransition();

  const lockedByName = lock.name;
  const lockedByMe = Boolean(lock.id && lock.id === currentUser.id);

  function flashSuccess(message) {
    setSuccess(message);
    window.setTimeout(() => setSuccess(''), 2600);
  }

  function handleStageChange(event) {
    const nextStage = event.target.value;

    setError('');

    startTransition(async () => {
      setOptimisticStage(nextStage);

      const result = await updateStageAction(aepCase.id, nextStage);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      flashSuccess('Etapa actualizada');
    });
  }

  function handleCategoryChange(event) {
    const nextCategory = event.target.value;

    setError('');

    startTransition(async () => {
      setOptimisticCategory(nextCategory);

      const result = await updateCategoryAction(aepCase.id, nextCategory);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      flashSuccess('Categoría actualizada');
    });
  }

  function handleLockToggle() {
    if (lockedByName && !lockedByMe) {
      setError(`${lockedByName} está trabajando este caso ahora.`);
      return;
    }

    setError('');

    startTransition(async () => {
      if (lockedByMe) {
        setOptimisticLock({ id: null, name: '' });
      } else {
        setOptimisticLock({ id: currentUser.id, name: currentUser.name });
      }

      const result = await toggleInCallAction(aepCase.id);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      flashSuccess(result.locked ? 'Caso marcado en llamada' : 'Caso liberado');
    });
  }

  const category = CATEGORY_STYLES[categoryValue] || CATEGORY_STYLES.CANCELADO;
  const address = fullAddress(client);
  const phone = client.phone || client.cell;
  const isLead = client.source === 'LEAD';
  const isDeceasedLead =
    isLead &&
    /passed away|fallecido/i.test(`${client.leadStatus || ''} ${client.leadTags || ''}`);

  const selectableStages = CASE_STAGES.filter(
    (stageOption) =>
      stageOption.value !== 'CERRADO_DOCS_ENVIADOS' ||
      aepCase.stage === 'CERRADO_DOCS_ENVIADOS'
  );

  const dataItems = [
    { label: 'DOB', value: client.dob },
    { label: 'Teléfono', value: phone },
    { label: 'MBI', value: client.mbi, mono: true },
    { label: 'Part A', value: client.partADate },
    { label: 'Part B', value: client.partBDate },
    { label: 'SS#', value: client.ssn, mono: true },
    { label: 'Medicaid', value: client.medicaidNumber, mono: true },
    { label: 'Dirección', value: address, wide: true },
  ];

  return (
    <section className="sticky top-16 z-30 -mx-4 border-y border-zinc-200/80 bg-white/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6 dark:border-zinc-800 dark:bg-zinc-950/95">
      <div className="mx-auto max-w-7xl space-y-2.5">
        <div className="flex flex-col gap-2.5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                {client.fullName || 'Cliente sin nombre'}
              </h1>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${category.className}`}
              >
                {category.label}
              </span>
              {isLead ? (
                <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30">
                  Lead
                </span>
              ) : null}
              {isDeceasedLead ? (
                <span className="inline-flex items-center rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30">
                  Fallecido
                </span>
              ) : null}
              {aepCase.eligibleHorizonCsnp ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30">
                  <AlertTriangle className="h-3 w-3" />
                  Horizon CSNP
                </span>
              ) : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
              <span className="inline-flex items-center gap-1">
                <UserRound className="h-3 w-3" />
                {aepCase.assignedTo?.name || 'Sin asignar'}
              </span>
              {client.radiusUrl ? (
                <a
                  href={client.radiusUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-0.5 font-medium text-sky-600 transition hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Abrir en Radius
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-zinc-400 dark:text-zinc-500">Sin link de Radius</span>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Categoría
              </span>
              <select
                aria-label="Cambiar categoría del caso"
                value={categoryValue}
                onChange={handleCategoryChange}
                disabled={pending}
                className={selectClasses}
              >
                {CASE_CATEGORIES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Agente
              </span>
              <AgentSelect
                caseId={aepCase.id}
                assignedToId={aepCase.assignedTo?.id || ''}
                agents={agents}
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                Etapa
              </span>
              <select
                aria-label="Cambiar etapa del caso"
                value={stage}
                onChange={handleStageChange}
                disabled={pending}
                className={selectClasses}
              >
                {selectableStages.map((stageOption) => (
                  <option key={stageOption.value} value={stageOption.value}>
                    {stageOption.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                <span className="inline-flex items-center gap-1">
                  <CalendarClock className="h-3 w-3" />
                  Seguimiento
                </span>
              </span>
              <FollowUpEditor
                caseId={aepCase.id}
                initialDate={aepCase.nextFollowUpDate || ''}
                initialTime={aepCase.nextFollowUpTime || ''}
              />
            </div>

            {lockedByName && !lockedByMe ? (
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 opacity-90 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                {lockedByName} está trabajando este caso
              </button>
            ) : lockedByMe ? (
              <button
                type="button"
                onClick={handleLockToggle}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300"
              >
                {pending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unlock className="h-3.5 w-3.5" />
                )}
                En llamada (tú) · Liberar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleLockToggle}
                disabled={pending}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? (
                  <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PhoneCall className="h-3.5 w-3.5" />
                )}
                📞 Marcar En Llamada
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-zinc-100 pt-2 text-[11px] sm:grid-cols-4 dark:border-zinc-800">
          {dataItems.map((item) => (
            <div
              key={item.label}
              className={item.wide ? 'col-span-2 sm:col-span-4 xl:col-span-2' : ''}
            >
              <span className="block text-[9px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                {item.label}
              </span>
              <span
                className={`block truncate text-zinc-700 dark:text-zinc-200 ${
                  item.mono ? 'font-mono text-[10px]' : ''
                }`}
                title={item.value || ''}
              >
                {item.value || '—'}
              </span>
            </div>
          ))}
        </div>

        {error ? (
          <p
            role="alert"
            className="flex items-center gap-1.5 rounded-lg bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300"
          >
            <AlertTriangle className="h-3 w-3" />
            {error}
          </p>
        ) : null}

        {success ? (
          <p className="rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {success}
          </p>
        ) : null}
      </div>
    </section>
  );
}
