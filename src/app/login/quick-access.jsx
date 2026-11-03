// src/app/login/quick-access.jsx
import { Zap } from 'lucide-react';
import { quickSignInAction } from '@/app/actions/auth';

const ACCOUNTS = [
  {
    name: 'Job',
    email: 'job@edufuture.org',
    shortCode: 'JOB',
    role: 'Agente',
    gradient: 'from-sky-500 to-cyan-500',
  },
  {
    name: 'Maria',
    email: 'maria@edufuture.org',
    shortCode: 'MARIA',
    role: 'Agente',
    gradient: 'from-rose-500 to-pink-500',
  },
  {
    name: 'Gabriela',
    email: 'gabriela@edufuture.org',
    shortCode: 'GABY',
    role: 'Agente',
    gradient: 'from-emerald-500 to-teal-500',
  },
  {
    name: 'Fernando',
    email: 'fernando@edufuture.org',
    shortCode: 'FER',
    role: 'Agente',
    gradient: 'from-amber-500 to-orange-600',
  },
];

function getInitials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase();
}

export default function QuickAccess() {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
        <Zap className="h-3.5 w-3.5" />
        Acceso rápido · solo desarrollo
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {ACCOUNTS.map((account) => (
          <form key={account.shortCode} action={quickSignInAction}>
            <input type="hidden" name="email" value={account.email} />
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl border border-amber-200/80 bg-white/80 px-2.5 py-2 text-left transition hover:border-amber-400 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/30 dark:border-amber-500/20 dark:bg-zinc-900/70 dark:hover:border-amber-500/50 dark:hover:bg-zinc-900"
            >
              <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${account.gradient} text-[11px] font-semibold text-white shadow-sm`}
              >
                {getInitials(account.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {account.name}
                </span>
                <span className="block truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                  {account.role} · {account.shortCode}
                </span>
              </span>
            </button>
          </form>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-amber-700/80 dark:text-amber-300/70">
        Contraseña del seed:{' '}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[10px] dark:bg-amber-500/10">
          medicare2026
        </code>
      </p>
    </div>
  );
}
