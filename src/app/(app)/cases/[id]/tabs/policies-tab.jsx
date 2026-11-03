'use client';

// src/app/(app)/cases/[id]/tabs/policies-tab.jsx
import { ExternalLink, ScrollText } from 'lucide-react';

const STATUS_STYLES = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30',
  termed: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  cancelled: 'bg-rose-50 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/30',
  inactive: 'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700',
};

function statusStyle(status) {
  const key = String(status || '').trim().toLowerCase();
  return (
    STATUS_STYLES[key] ||
    'bg-zinc-100 text-zinc-600 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700'
  );
}

function isCurrentPolicy(policy, currentPlanName) {
  const product = String(policy?.product || '').trim().toUpperCase();
  const plan = String(currentPlanName || '').trim().toUpperCase();

  if (!product || !plan) return false;

  return plan.includes(product) || product.includes(plan);
}

export default function PoliciesTab({
  policies,
  radiusUrl,
  currentCarrier,
  currentPlanName,
}) {
  const list = Array.isArray(policies) ? policies : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Historial de pólizas Radius
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {list.length} póliza{list.length === 1 ? '' : 's'} exportada
            {list.length === 1 ? '' : 's'} desde Radius.
            {currentCarrier ? ` Aseguradora actual: ${currentCarrier}.` : ''}
          </p>
        </div>

        {radiusUrl ? (
          <a
            href={radiusUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 transition hover:text-sky-700 hover:underline dark:text-sky-400 dark:hover:text-sky-300"
          >
            Ver perfil en Radius
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950/40">
          <ScrollText className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
            Sin pólizas registradas
          </p>
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            Este cliente no tiene historial de pólizas exportado desde Radius.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
                  <th className="px-3 py-2">Carrier</th>
                  <th className="px-3 py-2">Producto</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Policy No</th>
                  <th className="px-3 py-2">Customer Number</th>
                  <th className="px-3 py-2">Effective</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {list.map((policy, index) => {
                  const current = isCurrentPolicy(policy, currentPlanName);

                  return (
                    <tr
                      key={`${policy?.policyNo || policy?.carrier || 'policy'}-${index}`}
                      className={`align-top ${
                        current ? 'bg-sky-50/60 dark:bg-sky-500/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-medium text-zinc-800 dark:text-zinc-100">
                            {policy?.carrier || '—'}
                          </span>
                          {current ? (
                            <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                              Actual
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {policy?.product || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${statusStyle(policy?.status)}`}
                        >
                          {policy?.status || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                        {policy?.policyNo || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[10px] text-zinc-600 dark:text-zinc-300">
                        {policy?.customerNumber || '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-zinc-600 dark:text-zinc-300">
                        {policy?.effective || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
