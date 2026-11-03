'use client';

// src/app/(app)/cases/new/client-search.jsx
import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle, Search, X } from 'lucide-react';

export default function ClientSearch({ currentQuery }) {
  const router = useRouter();
  const [value, setValue] = useState(currentQuery || '');
  const [pending, startTransition] = useTransition();
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }

    const timer = window.setTimeout(() => {
      const term = value.trim();
      const query = term.length >= 2 ? `?q=${encodeURIComponent(term)}` : '';

      startTransition(() => {
        router.replace(`/cases/new${query}`);
      });
    }, 350);

    return () => window.clearTimeout(timer);
  }, [value, router, startTransition]);

  function handleSubmit(event) {
    event.preventDefault();
    const term = value.trim();
    const query = term.length >= 2 ? `?q=${encodeURIComponent(term)}` : '';

    startTransition(() => {
      router.replace(`/cases/new${query}`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />

      <input
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Buscar cliente por nombre o teléfono…"
        aria-label="Buscar cliente por nombre o teléfono"
        autoComplete="off"
        spellCheck={false}
        className="w-full rounded-xl border border-zinc-300 bg-white py-3 pl-9 pr-14 text-sm font-medium text-zinc-700 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:placeholder:text-zinc-500 [&::-webkit-search-cancel-button]:hidden"
      />

      <span className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
        {pending ? (
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-500" aria-label="Buscando" />
        ) : null}
        {value ? (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Limpiar búsqueda"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </span>
    </form>
  );
}
