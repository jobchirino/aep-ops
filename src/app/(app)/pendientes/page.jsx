// src/app/(app)/pendientes/page.jsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Inbox, UserRound } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getPendingCases } from '@/lib/queries';
import { formatFollowUpDateTime, getTodayRangeUtc } from '@/lib/datetime';
import { CASE_STAGE_BY_VALUE } from '@/lib/case-stages';
import { completeFollowUpAction } from '@/app/actions/pendingActions';
import PendingDoneButton from './pending-done-button';

export const instant = false;

function PendingGroup({ title, description, tone, cases }) {
  if (cases.length === 0) {
    return null;
  }

  const toneClasses = {
    overdue: {
      dot: 'bg-red-500',
      count: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30',
    },
    today: {
      dot: 'bg-amber-500',
      count:
        'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
    },
    upcoming: {
      dot: 'bg-sky-500',
      count:
        'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
    },
  }[tone];

  return (
    <section className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${toneClasses.dot}`} />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ring-1 ring-inset ${toneClasses.count}`}
        >
          {cases.length}
        </span>
        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">{description}</span>
      </div>

      <div className="space-y-2">
        {cases.map((aepCase) => {
          const client = aepCase.client;
          const phone = client?.phone || client?.cell || 'Sin teléfono';
          const stageLabel =
            CASE_STAGE_BY_VALUE[aepCase.stage]?.label || aepCase.stage || 'Sin etapa';

          return (
            <article
              key={aepCase.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {client?.fullName || 'Cliente sin nombre'}
                    </h3>
                    <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700">
                      {stageLabel}
                    </span>
                  </div>

                  <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                    {client?.state || 'Sin estado'} · {phone}
                  </p>

                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                    <span className="inline-flex items-center gap-1 font-medium">
                      <CalendarClock className="h-3 w-3" />
                      {formatFollowUpDateTime(aepCase.nextFollowUpAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <UserRound className="h-3 w-3" />
                      {aepCase.assignedTo?.name || 'Sin asignar'}
                    </span>
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Link
                    href={`/cases/${aepCase.id}`}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-xl border border-zinc-200 bg-white px-2.5 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    Abrir caso
                  </Link>

                  <form action={completeFollowUpAction}>
                    <input type="hidden" name="caseId" value={aepCase.id} />
                    <PendingDoneButton />
                  </form>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export default async function PendingPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const cases = await getPendingCases(user);
  const now = new Date();
  const { end } = getTodayRangeUtc(now);

  const groups = {
    overdue: [],
    today: [],
    upcoming: [],
  };

  for (const aepCase of cases) {
    const followUp = new Date(aepCase.nextFollowUpAt);

    if (followUp < now) {
      groups.overdue.push(aepCase);
    } else if (followUp <= end) {
      groups.today.push(aepCase);
    } else {
      groups.upcoming.push(aepCase);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al dashboard
      </Link>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
              Seguimientos
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              Pendientes
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Tus casos asignados y los que no tienen agente. Al marcar <strong>Hecho</strong>, el
              seguimiento se cierra y el caso sale de esta lista.
            </p>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-950/40 dark:ring-zinc-800">
            <CheckCircle2 className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
            <span className="text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {cases.length}
            </span>
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400">pendientes</span>
          </div>
        </div>
      </section>

      {cases.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-14 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <Inbox className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            No tienes pendientes
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Los casos con seguimiento aparecerán aquí, incluso los que aún no vencen.
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          <PendingGroup
            title="Vencidos"
            description="Ya pasó la fecha y hora."
            tone="overdue"
            cases={groups.overdue}
          />
          <PendingGroup
            title="Hoy"
            description="Todavía quedan por atender hoy."
            tone="today"
            cases={groups.today}
          />
          <PendingGroup
            title="Próximos"
            description="Seguimientos de días siguientes."
            tone="upcoming"
            cases={groups.upcoming}
          />
        </div>
      )}
    </div>
  );
}
