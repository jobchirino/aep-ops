// src/app/login/page.jsx
import { redirect } from 'next/navigation';
import { HeartPulse, ShieldCheck } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import LoginForm from './login-form';
import QuickAccess from './quick-access';

export const metadata = {
  title: 'Iniciar sesión · AEP Ops 2027',
  description: 'Acceso al sistema operativo AEP Medicare de EduFuture.',
};

// La comprobación de sesión se resuelve antes de renderizar para poder
// redirigir con un 307 real y no con un redirect en streaming.
export const instant = false;

export default async function LoginPage() {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  const user = await getCurrentUser();

  // En producción, si ya hay sesión no tiene sentido mostrar el login.
  // En desarrollo se permite entrar para cambiar de cuenta con un clic.
  if (user && !isDevelopment) {
    redirect('/');
  }

  return (
    <div className="relative flex min-h-screen flex-1 items-center justify-center overflow-hidden bg-zinc-50 px-4 py-10 dark:bg-zinc-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-80 w-80 rounded-full bg-sky-200/40 blur-3xl dark:bg-sky-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-violet-200/40 blur-3xl dark:bg-violet-500/10"
      />

      <div className="relative w-full max-w-md">
        <div className="rounded-3xl border border-zinc-200/80 bg-white p-6 shadow-xl shadow-zinc-200/40 sm:p-8 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-black/20">
          <div className="mb-6 flex flex-col items-center text-center">
            <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-500 text-white shadow-lg shadow-sky-500/20">
              <HeartPulse className="h-7 w-7" />
            </span>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              AEP Ops <span className="text-sky-600 dark:text-sky-400">2027</span>
            </h1>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              Sistema Operativo Medicare · EduFuture
            </p>
          </div>

          {isDevelopment && user ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              Sesión activa como <strong>{user.name}</strong>. Elige otra cuenta abajo para
              cambiarla al instante.
            </div>
          ) : null}

          <LoginForm />

          {isDevelopment ? <QuickAccess /> : null}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Acceso restringido al equipo AEP
        </p>
      </div>
    </div>
  );
}
