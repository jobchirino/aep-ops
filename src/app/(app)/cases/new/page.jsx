// src/app/(app)/cases/new/page.jsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Search, UserRound, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { searchClientsForNewCase } from '@/lib/clients';
import { getAgents } from '@/lib/users';
import { CASE_STAGE_BY_VALUE } from '@/lib/case-stages';
import ClientSearch from './client-search';
import AddCaseForm from './add-case-form';

export const instant = false;

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function NewCasePage({ searchParams }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const params = (await searchParams) || {};
  const queryParam = firstValue(params.q);
  const searchTerm =
    typeof queryParam === 'string' ? queryParam.trim().slice(0, 80) : '';

  const [clients, agents, totalClients] = await Promise.all([
    searchClientsForNewCase(searchTerm),
    getAgents(),
    prisma.client.count(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al dashboard
      </Link>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
          Nuevo caso AEP
        </p>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Agregar un cliente de Radius al AEP
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Busca por nombre o teléfono entre los {totalClients.toLocaleString('es-US')} clientes
          cargados de Radius. Solo se pueden agregar clientes existentes; si ya tiene un caso, se
          muestra el enlace al caso actual.
        </p>

        <div className="mt-4">
          <ClientSearch currentQuery={searchTerm} />
        </div>

        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">
          <Search className="h-3 w-3" />
          Nombre, apellido o teléfono. Mínimo 2 caracteres.
        </p>
      </section>

      {searchTerm.length < 2 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <Users className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Busca al cliente que llamó
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Los {totalClients.toLocaleString('es-US')} clientes de Radius ya están en la base.
          </p>
        </section>
      ) : clients.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <UserRound className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            No encontramos ese cliente en Radius
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Verifica el nombre o el teléfono. En esta fase solo se agregan clientes existentes de
            Radius.
          </p>
        </section>
      ) : (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Resultados
            </h2>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {clients.length}
            </span>
          </div>

          <div className="space-y-3">
            {clients.map((client) => {
              const existingCase = client.aepCases?.[0];
              const stageLabel = existingCase
                ? CASE_STAGE_BY_VALUE[existingCase.stage]?.label || existingCase.stage
                : '';
              const phone = client.phone || client.cell || 'Sin teléfono';

              return (
                <article
                  key={client.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {client.fullName}
                      </h3>
                      <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                        {client.state || 'Sin estado'} · {phone}
                        {client.dob ? ` · DOB ${client.dob}` : ''}
                        {client.mbi ? ` · MBI ${client.mbi}` : ''}
                      </p>
                    </div>

                    {existingCase ? (
                      <span className="inline-flex shrink-0 items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/30">
                        Ya tiene caso AEP
                      </span>
                    ) : null}
                  </div>

                  {existingCase ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <span className="font-medium">Etapa actual: {stageLabel}.</span>
                      <Link
                        href={`/cases/${existingCase.id}`}
                        className="font-semibold underline underline-offset-2"
                      >
                        Abrir caso existente
                      </Link>
                    </div>
                  ) : (
                    <AddCaseForm
                      clientId={client.id}
                      clientName={client.fullName}
                      agents={agents}
                      currentUserId={user.id}
                    />
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
