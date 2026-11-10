'use client';

// src/app/(app)/case-filters.jsx
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, SlidersHorizontal, X } from 'lucide-react';
import { CASE_CATEGORIES } from '@/lib/case-categories';

const selectClasses =
  'rounded-xl border border-zinc-300 bg-white px-3 py-2 text-xs font-medium text-zinc-700 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200';

export default function CaseFilters({
  stages,
  currentStage,
  currentAgent,
  currentCategory,
  currentSearch,
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const hasFilters = Boolean(currentCategory) || Boolean(currentStage) || currentAgent !== 'all';

  function applyFilters(nextStage, nextAgent, nextCategory) {
    const params = new URLSearchParams();

    if (nextCategory) params.set('category', nextCategory);
    if (nextStage) params.set('stage', nextStage);
    if (nextAgent && nextAgent !== 'all') params.set('agent', nextAgent);
    if (String(currentSearch || '').trim()) params.set('q', String(currentSearch).trim());

    const query = params.toString();
    startTransition(() => {
      router.push(query ? `/?${query}` : '/');
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filtros
      </span>

      <select
        aria-label="Filtrar por categoría"
        value={currentCategory}
        onChange={(event) =>
          applyFilters(currentStage, currentAgent, event.target.value)
        }
        className={selectClasses}
      >
        <option value="">Todas las categorías</option>
        {CASE_CATEGORIES.map((category) => (
          <option key={category.value} value={category.value}>
            {category.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por etapa"
        value={currentStage}
        onChange={(event) =>
          applyFilters(event.target.value, currentAgent, currentCategory)
        }
        className={selectClasses}
      >
        <option value="">Todas las etapas</option>
        {stages.map((stage) => (
          <option key={stage.value} value={stage.value}>
            {stage.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filtrar por agente"
        value={currentAgent}
        onChange={(event) =>
          applyFilters(currentStage, event.target.value, currentCategory)
        }
        className={selectClasses}
      >
        <option value="all">Todos los agentes</option>
        <option value="mine">Mis casos</option>
        <option value="unassigned">Sin asignar</option>
      </select>

      {hasFilters ? (
        <button
          type="button"
          onClick={() => applyFilters('', 'all', '')}
          className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-medium text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <X className="h-3.5 w-3.5" />
          Limpiar
        </button>
      ) : null}

      {pending ? (
        <LoaderCircle className="h-4 w-4 animate-spin text-sky-500" aria-label="Actualizando" />
      ) : null}
    </div>
  );
}
