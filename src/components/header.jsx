// src/components/header.jsx
import { Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { CalendarClock, LogOut, ShieldCheck } from 'lucide-react';
import { getPendingTodayCount } from '@/lib/queries';
import { signOutAction } from '@/app/actions/auth';

const ROLE_STYLES = {
  AGENT: {
    label: 'Agente',
    Icon: ShieldCheck,
    className:
      'bg-sky-100 text-sky-700 ring-sky-200 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30',
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

export default function Header({ user }) {
  const role = ROLE_STYLES[user.role] ?? ROLE_STYLES.AGENT;
  const RoleIcon = role.Icon;
  const avatarGradient = AVATAR_STYLES[user.shortCode] ?? 'from-zinc-500 to-zinc-600';

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white p-0.5 shadow-sm dark:border-zinc-700">
            <Image
              src="/img/logo.png"
              alt="AEP Ops 2027"
              width={1545}
              height={1999}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <span className="min-w-0">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
                AEP Ops
              </span>
              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                2027
              </span>
            </span>
            <span className="hidden text-[11px] text-zinc-500 sm:block dark:text-zinc-400">
              Medicare · EduFuture
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2 sm:gap-3">
          <Suspense fallback={<PendingCountSkeleton />}>
            <PendingTodayBadge user={user} />
          </Suspense>

          <span className="hidden h-8 w-px bg-zinc-200 sm:block dark:bg-zinc-800" />

          <div className="flex items-center gap-2">
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${avatarGradient} text-xs font-semibold text-white shadow-sm`}
            >
              {getInitials(user.name)}
            </span>
            <span className="min-w-0">
              <span className="hidden max-w-[140px] truncate text-sm font-medium leading-tight text-zinc-900 sm:block dark:text-zinc-50">
                {user.name}
              </span>
              <span className="flex items-center gap-1.5 sm:mt-1">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${role.className}`}
                >
                  <RoleIcon className="h-3 w-3" />
                  {role.label}
                </span>
                <span className="hidden font-mono text-[10px] text-zinc-400 sm:inline dark:text-zinc-500">
                  {user.shortCode}
                </span>
              </span>
            </span>
          </div>

          <form action={signOutAction}>
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-red-500/30 dark:hover:bg-red-500/10 dark:hover:text-red-400"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

async function PendingTodayBadge({ user }) {
  const counts = await getPendingTodayCount(user);
  const hasError = counts === null;
  const overdue = counts?.overdue ?? 0;
  const today = counts?.today ?? 0;
  const hasAny = overdue > 0 || today > 0;

  return (
    <div
      title="Vencidos: ya pasó su hora. Hoy: aún quedan por atender hoy. Horario de New Jersey (ET). Incluye tus casos asignados + los que no tienen agente."
      className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium ring-1 ring-inset ${
        hasError
          ? 'bg-zinc-100 text-zinc-500 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700'
          : hasAny
            ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30'
            : 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30'
      }`}
    >
      <CalendarClock className="h-3.5 w-3.5 shrink-0" />
      {hasError ? (
        <span className="tabular-nums font-semibold">—</span>
      ) : (
        <>
          <span
            className={`tabular-nums font-semibold ${
              overdue > 0 ? 'text-red-600 dark:text-red-400' : ''
            }`}
          >
            {overdue}
            <span className="hidden md:inline"> vencidos</span>
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <span
            className={`tabular-nums font-semibold ${
              today > 0 ? 'text-amber-700 dark:text-amber-300' : ''
            }`}
          >
            {today}
            <span className="hidden md:inline"> hoy</span>
          </span>
        </>
      )}
    </div>
  );
}

function PendingCountSkeleton() {
  return (
    <div className="h-8 w-24 animate-pulse rounded-full bg-zinc-100 dark:bg-zinc-800" />
  );
}
