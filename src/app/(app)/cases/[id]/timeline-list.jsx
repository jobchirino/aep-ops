// src/app/(app)/cases/[id]/timeline-list.jsx
import CopyButton from '@/components/copy-button';

const EVENT_STYLES = {
  NOTE: {
    label: 'Nota',
    className:
      'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
  },
  SMS_VOICEMAIL: {
    label: 'NC + SMS',
    className:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  CALL_NC: {
    label: 'No contestó',
    className:
      'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30',
  },
  CALL_ANSWERED: {
    label: 'Llamada',
    className:
      'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-500/30',
  },
  STATUS_CHANGE: {
    label: 'Etapa',
    className:
      'bg-indigo-50 text-indigo-700 ring-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-500/30',
  },
  ASSIGNMENT: {
    label: 'Asignación',
    className:
      'bg-cyan-50 text-cyan-700 ring-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-300 dark:ring-cyan-500/30',
  },
  CATEGORY_CHANGE: {
    label: 'Categoría',
    className:
      'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-500/30',
  },
  DOCS_READY: {
    label: 'Docs listos',
    className:
      'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30',
  },
};

const AVATAR_STYLES = {
  JOB: 'from-sky-500 to-cyan-500',
  MARIA: 'from-rose-500 to-pink-500',
  GABY: 'from-emerald-500 to-teal-500',
  FER: 'from-amber-500 to-orange-600',
};

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

export default function TimelineList({ events }) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Línea de tiempo
        </h2>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-3 py-6 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-500">
          Aún no hay eventos. Registra la primera nota o marcar el caso en llamada.
        </p>
      ) : (
        <ol className="relative mt-4 space-y-4 border-l border-zinc-200 pl-5 dark:border-zinc-800">
          {events.map((event) => {
            const type = EVENT_STYLES[event.eventType] || EVENT_STYLES.NOTE;
            const gradient = AVATAR_STYLES[event.user?.shortCode] || 'from-zinc-500 to-zinc-600';

            return (
              <li key={event.id} className="relative">
                <span
                  className={`absolute -left-[33px] top-0 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br ${gradient} text-[9px] font-semibold text-white ring-2 ring-white dark:ring-zinc-900`}
                  title={event.user?.name || event.user?.shortCode || 'Sistema'}
                >
                  {getInitials(event.user?.name || event.user?.shortCode)}
                </span>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/40">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-100">
                      {event.user?.name || 'Sistema'}
                    </span>
                    <span className="font-mono text-[9px] uppercase text-zinc-400 dark:text-zinc-500">
                      {event.user?.shortCode || 'SYS'}
                    </span>
                    <span
                      className={`inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset ${type.className}`}
                    >
                      {type.label}
                    </span>
                    <span className="ml-auto text-[9px] tabular-nums text-zinc-400 dark:text-zinc-500">
                      {event.createdAtLabel}
                    </span>
                  </div>

                  <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-zinc-600 dark:text-zinc-300">
                    {event.content}
                  </p>

                  {event.radiusFormattedNote ? (
                    <div className="mt-2 flex items-start gap-2 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 dark:border-zinc-700 dark:bg-zinc-900">
                      <p
                        className="line-clamp-2 flex-1 font-mono text-[9px] leading-relaxed text-zinc-500 dark:text-zinc-400"
                        title={event.radiusFormattedNote}
                      >
                        {event.radiusFormattedNote}
                      </p>
                      <CopyButton
                        text={event.radiusFormattedNote}
                        label="Radius"
                        copiedLabel="Copiado"
                        className="shrink-0"
                      />
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
