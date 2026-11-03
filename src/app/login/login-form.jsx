'use client';

// src/app/login/login-form.jsx
import { useActionState } from 'react';
import { AlertCircle, ArrowRight, LoaderCircle, Lock, Mail } from 'lucide-react';
import { signInAction } from '@/app/actions/auth';

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(signInAction, {});

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Correo
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="nombre@edufuture.org"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
        >
          Contraseña
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className={inputClasses}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Entrando…
          </>
        ) : (
          <>
            Entrar al sistema
            <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
    </form>
  );
}
