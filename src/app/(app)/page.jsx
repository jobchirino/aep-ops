// src/app/(app)/page.jsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  Inbox,
  PhoneIncoming,
  Plus,
  RefreshCw,
  Target,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getDashboardData } from '@/lib/dashboard';
import { getAgents } from '@/lib/users';
import NcSmsButton from '@/components/nc-sms-button';
import AgentSelect from '@/components/agent-select';
import { Progress } from '@/components/ui/progress';
import CaseFilters from './case-filters';
import CaseSearch from './case-search';

export const instant = false;

const AEP_GOAL = 50;

const STAGES = [
  {
    value: 'SIN_CONTACTAR',
    label: 'Sin contactar',
    className:
      'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  },
  {
    value: 'EN_SEGUIMIENTO',
    label: 'En seguimiento',
    className:
      'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  },
  {
    value: 'PUNTOS_COMPLETOS',
    label: 'Puntos completos',
    className:
      'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  },
  {
    value: 'BUSCANDO_PLAN',
    label: 'Buscando plan',
    className:
      'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30',
  },
  {
    value: 'ESPERANDO_FIRMA',
    label: 'Esperando firma',
    className:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  {
    value: 'CERRADO_DOCS_ENVIADOS',
    label: 'Cerrado · Docs enviados',
    className:
      'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  },
  {
    value: 'DESCARTADO',
    label: 'Descartado',
    className:
      'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  },
];

const STAGE_BY_VALUE = Object.fromEntries(STAGES.map((stage) => [stage.value, stage]));

const CATEGORY_CARDS = [
  {
    category: 'NO_RENOVABLE',
    label: 'No renovable',
    Icon: RefreshCw,
    iconClassName:
      'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300',
  },
  {
    category: 'NO_COMISIONABLE',
    label: 'No comisionable',
    Icon: Ban,
    iconClassName:
      'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  {
    category: 'CANCELADO',
    label: 'Cancelado',
    Icon: Inbox,
    iconClassName:
      'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  },
  {
    category: 'ENTRANTE',
    label: 'Entrantes',
    Icon: PhoneIncoming,
    iconClassName:
      'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-300',
  },
];

const noteDateFormatter = new Intl.DateTimeFormat('es-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DashboardPage({ searchParams }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const params = (await searchParams) || {};
  const stageParam = firstValue(params.stage);
  const agentParam = firstValue(params.agent);
  const queryParam = firstValue(params.q);

  const stage = STAGE_BY_VALUE[stageParam] ? stageParam : '';
  const agent = ['all', 'mine', 'unassigned'].includes(agentParam) ? agentParam : 'all';
  const searchTerm =
    typeof queryParam === 'string' ? queryParam.trim().slice(0, 80) : '';

  const [{ cases, stats, totalCases }, agents] = await Promise.all([
    getDashboardData({
      stage,
      agent,
      userId: user.id,
      searchTerm,
    }),
    getAgents(),
  ]);

  const countByCategory = (category) => {
    if (category === 'NO_RENOVABLE') return stats.noRenovable;
    if (category === 'NO_COMISIONABLE') return stats.noComisionable;
    if (category === 'CANCELADO') return stats.cancelado;
    if (category === 'ENTRANTE') return stats.entrante;
    return 0;
  };

  const closedDocsCount = stats.closed;
  const goalPercent = Math.min(100, Math.round((closedDocsCount / AEP_GOAL) * 100));

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            AEP 2027 · Operación
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Dashboard de casos
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {totalCases} casos cargados. Filtra por etapa o agente y registra el seguimiento
            directamente desde la tabla.
          </p>
        </div>

        <Link
          href="/cases/new"
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/30"
        >
          <Plus className="h-4 w-4" />
          Nuevo caso AEP
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {CATEGORY_CARDS.map(({ category, label, Icon, iconClassName }) => (
          <StatCard
            key={category}
            label={label}
            value={countByCategory(category)}
            Icon={Icon}
            iconClassName={iconClassName}
          />
        ))}
      </section>

      <GoalCard count={closedDocsCount} goal={AEP_GOAL} percent={goalPercent} />

      <section className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-wrap items-center gap-2 px-1">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Casos operativos
          </h2>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
            {cases.length}
          </span>
          {stage || agent !== 'all' || searchTerm ? (
            <span className="text-[11px] text-zinc-400 dark:text-zinc-500">filtrados</span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <CaseSearch
            currentQuery={searchTerm}
            currentStage={stage}
            currentAgent={agent}
          />
          <CaseFilters
            stages={STAGES}
            currentStage={stage}
            currentAgent={agent}
            currentSearch={searchTerm}
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/80 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Plan actual</th>
                <th className="px-4 py-3">Agente</th>
                <th className="px-4 py-3">Última nota</th>
                <th className="px-4 py-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cases.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <Inbox className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
                    <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                      {searchTerm
                        ? `No hay casos para “${searchTerm}”`
                        : 'No hay casos con estos filtros'}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
                      {searchTerm
                        ? 'Prueba con otro nombre o teléfono, o limpia la búsqueda.'
                        : 'Cambia la etapa o el agente para ver otros resultados.'}
                    </p>
                  </td>
                </tr>
              ) : (
                cases.map((aepCase) => (
                  <CaseRow key={aepCase.id} aepCase={aepCase} agents={agents} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value, Icon, iconClassName, caption }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconClassName}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
          {value}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-zinc-600 dark:text-zinc-300">
          {label}
        </p>
        {caption ? (
          <p className="truncate text-[10px] text-zinc-400 dark:text-zinc-500">{caption}</p>
        ) : null}
      </div>
    </div>
  );
}

function GoalCard({ count, goal, percent }) {
  const goalReached = count >= goal;

  return (
    <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 shadow-sm dark:border-emerald-500/30 dark:from-emerald-500/10 dark:via-zinc-900 dark:to-teal-500/10">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
            <Target className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-emerald-700 dark:text-emerald-300">
              Meta de Aplicaciones AEP
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-600/80 dark:text-emerald-300/70">
              Progreso de cierres · Docs enviados
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2 sm:justify-end">
          <span className="text-3xl font-semibold leading-none tabular-nums text-zinc-900 dark:text-zinc-50">
            {count}
          </span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            de {goal} aplicaciones
          </span>
          <span className="text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            {percent}%
          </span>
        </div>
      </div>

      <Progress
        value={percent}
        aria-label={`Meta de aplicaciones AEP: ${count} de ${goal}`}
        className="mt-3 h-2.5 bg-emerald-100 dark:bg-emerald-500/15"
        indicatorClassName="bg-emerald-600"
      />

      <p className="mt-1.5 text-[10px] text-emerald-700/80 dark:text-emerald-300/70">
        {goalReached
          ? '¡Meta alcanzada!'
          : `${goal - count} aplicaciones para alcanzar la meta`}
      </p>
    </div>
  );
}

function StageBadge({ stage }) {
  const stageInfo = STAGE_BY_VALUE[stage] ?? {
    label: stage,
    className:
      'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${stageInfo.className}`}
    >
      {stageInfo.label}
    </span>
  );
}

function CaseRow({ aepCase, agents }) {
  const client = aepCase.client;
  const lastEvent = aepCase.timeline?.[0];
  const phone = client?.phone || client?.cell || null;

  return (
    <tr className="align-top transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30">
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {client?.fullName || 'Cliente sin nombre'}
          </p>
          <StageBadge stage={aepCase.stage} />
        </div>
        <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
          {client?.state || 'Sin estado'} · {phone || 'Sin teléfono'}
        </p>
        {aepCase.lockedByUser ? (
          <span className="mt-1 inline-flex items-center rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
            📞 {aepCase.lockedByUser.name} está trabajando este caso ahora
          </span>
        ) : null}
        {client?.radiusUrl ? (
          <a
            href={client.radiusUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-sky-600 transition hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
          >
            Abrir en Radius
            <ArrowUpRight className="h-3 w-3" />
          </a>
        ) : (
          <span className="mt-1 inline-block text-[11px] text-zinc-400 dark:text-zinc-500">
            Sin link de Radius
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <p className="max-w-[220px] truncate text-xs font-medium text-zinc-800 dark:text-zinc-100">
          {aepCase.currentPlanName || 'Sin plan registrado'}
        </p>
        <p className="mt-0.5 text-[11px] uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
          {aepCase.currentCarrier || 'Aseguradora sin definir'}
        </p>
        {aepCase.eligibleHorizonCsnp ? (
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-500/10 dark:text-orange-300 dark:ring-orange-500/30">
            <AlertTriangle className="h-3 w-3" />
            Horizon CSNP
          </span>
        ) : null}
      </td>

      <td className="px-4 py-3">
        <AgentSelect
          caseId={aepCase.id}
          assignedToId={aepCase.assignedTo?.id || ''}
          agents={agents}
          compact
        />
      </td>

      <td className="px-4 py-3">
        {lastEvent ? (
          <div className="max-w-[260px]">
            <p
              className="line-clamp-2 text-xs leading-relaxed text-zinc-600 dark:text-zinc-300"
              title={lastEvent.content}
            >
              {lastEvent.content}
            </p>
            <p className="mt-1 text-[10px] text-zinc-400 dark:text-zinc-500">
              {lastEvent.user?.name || 'Sistema'} · {noteDateFormatter.format(lastEvent.createdAt)}
            </p>
          </div>
        ) : (
          <span className="text-xs italic text-zinc-400 dark:text-zinc-500">Sin notas aún</span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:justify-end">
          <NcSmsButton caseId={aepCase.id} />
          <Link
            href={`/cases/${aepCase.id}`}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl bg-zinc-900 px-2.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Abrir Caso
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </td>
    </tr>
  );
}
