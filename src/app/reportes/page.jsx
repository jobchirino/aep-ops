// src/app/reportes/page.jsx
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, Download, Target } from 'lucide-react';
import { prisma } from '@/lib/prisma';
import { APP_TIME_ZONE } from '@/lib/datetime';
import { getDiscardReason } from '@/lib/discard-reasons';
import PrintButton from './print-button';

export const metadata = {
  title: 'Reporte ejecutivo AEP 2027',
  description: 'Resumen de clientes por categoría y estado para la presentación interna.',
};

export const instant = false;

const AEP_GOAL = 50;

const CATEGORIES = [
  {
    value: 'NO_RENOVABLE',
    label: 'No renovable',
    dotClassName: 'bg-rose-500',
    textClassName: 'text-rose-700',
    softClassName: 'bg-rose-50',
  },
  {
    value: 'NO_COMISIONABLE',
    label: 'No comisionable',
    dotClassName: 'bg-amber-500',
    textClassName: 'text-amber-700',
    softClassName: 'bg-amber-50',
  },
  {
    value: 'CLOVER_REENROLL',
    label: 'Clover ReEnroll',
    dotClassName: 'bg-violet-500',
    textClassName: 'text-violet-700',
    softClassName: 'bg-violet-50',
  },
  {
    value: 'CANCELADO',
    label: 'Cancelado',
    dotClassName: 'bg-zinc-500',
    textClassName: 'text-zinc-700',
    softClassName: 'bg-zinc-100',
  },
];

const CATEGORY_BY_VALUE = Object.fromEntries(
  CATEGORIES.map((category) => [category.value, category])
);

const STATUSES = [
  {
    key: 'closed',
    label: 'Cerrados',
    description: 'Documentos enviados',
    barClassName: 'bg-emerald-500',
    textClassName: 'text-emerald-700',
    hex: '#10b981',
  },
  {
    key: 'inProgress',
    label: 'En proceso',
    description: 'Ya contactados / trabajando',
    barClassName: 'bg-sky-500',
    textClassName: 'text-sky-700',
    hex: '#0ea5e9',
  },
  {
    key: 'notContacted',
    label: 'Sin contactar',
    description: 'Aún no se han llamado',
    barClassName: 'bg-amber-400',
    textClassName: 'text-amber-700',
    hex: '#fbbf24',
  },
  {
    key: 'discarded',
    label: 'Descartados',
    description: 'No continúan',
    barClassName: 'bg-zinc-400',
    textClassName: 'text-zinc-600',
    hex: '#a1a1aa',
  },
];

const IN_PROGRESS_STAGES = new Set([
  'EN_SEGUIMIENTO',
  'PUNTOS_COMPLETOS',
  'BUSCANDO_PLAN',
  'ESPERANDO_FIRMA',
]);

function emptyCategory(category) {
  return {
    ...category,
    total: 0,
    closed: 0,
    inProgress: 0,
    notContacted: 0,
    discarded: 0,
  };
}

function formatReportDate() {
  return new Intl.DateTimeFormat('es-US', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date());
}

export default async function ReportPage() {
  const [rows, discardedCases] = await Promise.all([
    prisma.aepCase.groupBy({
      by: ['category', 'stage'],
      where: { category: { not: 'ENTRANTE' } },
      _count: { _all: true },
    }),
    prisma.aepCase.findMany({
      where: { stage: 'DESCARTADO', category: { not: 'ENTRANTE' } },
      select: {
        id: true,
        category: true,
        client: { select: { fullName: true } },
        timeline: {
          where: { eventType: 'NOTE' },
          select: { content: true, createdAt: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);

  const categoryMap = new Map(
    CATEGORIES.map((category) => [category.value, emptyCategory(category)])
  );

  for (const row of rows) {
    const item = categoryMap.get(row.category);

    if (!item) continue;

    const count = row._count._all;
    item.total += count;

    if (row.stage === 'CERRADO_DOCS_ENVIADOS') {
      item.closed += count;
    } else if (row.stage === 'SIN_CONTACTAR') {
      item.notContacted += count;
    } else if (row.stage === 'DESCARTADO') {
      item.discarded += count;
    } else if (IN_PROGRESS_STAGES.has(row.stage)) {
      item.inProgress += count;
    } else {
      item.inProgress += count;
    }
  }

  const categories = [...categoryMap.values()];
  const totals = categories.reduce(
    (accumulator, category) => ({
      total: accumulator.total + category.total,
      closed: accumulator.closed + category.closed,
      inProgress: accumulator.inProgress + category.inProgress,
      notContacted: accumulator.notContacted + category.notContacted,
      discarded: accumulator.discarded + category.discarded,
    }),
    { total: 0, closed: 0, inProgress: 0, notContacted: 0, discarded: 0 }
  );

  const pendingTotal = totals.inProgress + totals.notContacted;
  const goalPercent = Math.min(100, Math.round((totals.closed / AEP_GOAL) * 100));

  const donutSegments = STATUSES.map((status, index) => {
    const count = totals[status.key];
    const percent = totals.total > 0 ? (count / totals.total) * 100 : 0;
    const offset =
      totals.total > 0
        ? STATUSES.slice(0, index).reduce(
            (sum, previousStatus) =>
              sum + (totals[previousStatus.key] / totals.total) * 100,
            0
          )
        : 0;

    return {
      ...status,
      count,
      percent,
      dashArray: `${percent} ${100 - percent}`,
      dashOffset: -offset,
    };
  });

  const discardedWithReasons = discardedCases
    .map((aepCase) => ({
      ...aepCase,
      reason: getDiscardReason(aepCase),
    }))
    .sort((left, right) => {
      const leftCategory = CATEGORIES.findIndex(
        (category) => category.value === left.category
      );
      const rightCategory = CATEGORIES.findIndex(
        (category) => category.value === right.category
      );

      if (leftCategory !== rightCategory) return leftCategory - rightCategory;

      return String(left.client?.fullName || '').localeCompare(
        String(right.client?.fullName || ''),
        'es'
      );
    });

  const discardedWithReason = discardedWithReasons.filter((item) => item.reason);
  const discardedWithoutReason = discardedWithReasons.filter((item) => !item.reason);

  return (
    <main className="report-page mx-auto max-w-5xl space-y-5 bg-white px-4 py-6 text-zinc-900 sm:px-8 sm:py-10">
      <header className="flex flex-col gap-4 border-b border-zinc-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
            <Image
              src="/img/logo.png"
              alt="AEP Ops 2027"
              width={1545}
              height={1999}
              priority
              className="h-full w-full object-contain"
            />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-600">
              AEP 2027 · Reporte ejecutivo
            </p>
            <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-zinc-950">
              Clientes por categoría y estado
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Datos al {formatReportDate()} · No incluye Entrantes
            </p>
          </div>
        </div>

        <div className="no-print flex items-center gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-800"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver
          </Link>
          <PrintButton />
        </div>
      </header>

      <section className="report-section grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="Total clientes" value={totals.total} accent="text-zinc-950" />
        <KpiCard label="Total cerrados" value={totals.closed} accent="text-emerald-700" />
        <KpiCard label="Pendientes totales" value={pendingTotal} accent="text-sky-700" />
        <KpiCard label="En proceso" value={totals.inProgress} accent="text-sky-700" />
        <KpiCard label="Sin contactar" value={totals.notContacted} accent="text-amber-700" />
        <KpiCard label="Descartados" value={totals.discarded} accent="text-zinc-600" />
      </section>

      <section className="report-section rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <Target className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
                Meta de 50 aplicaciones
              </p>
              <p className="text-[11px] text-emerald-700/80">
                Cierres que cuentan para la meta
              </p>
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold leading-none tabular-nums text-emerald-800">
              {totals.closed}
            </span>
            <span className="text-sm text-emerald-700/80">de {AEP_GOAL}</span>
            <span className="text-sm font-semibold tabular-nums text-emerald-700">
              {goalPercent}%
            </span>
          </div>
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-emerald-100">
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${goalPercent}%` }}
          />
        </div>
      </section>

      <section className="report-section grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(260px,0.8fr)]">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Distribución por categoría
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Cada barra muestra el total de la categoría y su estado actual.
              </p>
            </div>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-zinc-600">
              {totals.total}
            </span>
          </div>

          <div className="mt-5 space-y-4">
            {categories.map((category) => (
              <div key={category.value}>
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${category.dotClassName}`} />
                    <span className="text-xs font-semibold text-zinc-700">
                      {category.label}
                    </span>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-zinc-900">
                    {category.total}
                  </span>
                </div>

                <div className="flex h-7 overflow-hidden rounded-full bg-zinc-100">
                  {STATUSES.map((status) => {
                    const count = category[status.key];
                    const width = category.total > 0 ? (count / category.total) * 100 : 0;

                    if (count === 0) return null;

                    return (
                      <div
                        key={status.key}
                        className={`${status.barClassName} h-full`}
                        style={{ width: `${width}%` }}
                        title={`${status.label}: ${count}`}
                      />
                    );
                  })}
                </div>

                <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-zinc-500">
                  {STATUSES.map((status) => (
                    <span key={status.key} className="inline-flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${status.barClassName}`} />
                      {status.label}:{' '}
                      <strong className="font-semibold tabular-nums text-zinc-700">
                        {category[status.key]}
                      </strong>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-zinc-900">Estado general</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">Todos los clientes del reporte.</p>

          <div className="mt-4 flex justify-center">
            <svg viewBox="0 0 42 42" className="h-48 w-48" role="img" aria-label="Distribución por estado">
              <circle cx="21" cy="21" r="15.9155" fill="none" stroke="#f4f4f5" strokeWidth="6" />
              <g transform="rotate(-90 21 21)">
                {donutSegments.map((segment) =>
                  segment.count > 0 ? (
                    <circle
                      key={segment.key}
                      cx="21"
                      cy="21"
                      r="15.9155"
                      fill="none"
                      stroke={segment.hex}
                      strokeWidth="6"
                      strokeDasharray={segment.dashArray}
                      strokeDashoffset={segment.dashOffset}
                    />
                  ) : null
                )}
              </g>
              <text
                x="21"
                y="20.5"
                textAnchor="middle"
                className="fill-zinc-950 text-[5px] font-semibold"
              >
                {totals.total}
              </text>
              <text
                x="21"
                y="24"
                textAnchor="middle"
                className="fill-zinc-500 text-[2.5px]"
              >
                clientes
              </text>
            </svg>
          </div>

          <div className="mt-4 space-y-2">
            {donutSegments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between gap-3 text-xs">
                <span className="inline-flex items-center gap-2 text-zinc-600">
                  <span className={`h-2.5 w-2.5 rounded-full ${segment.barClassName}`} />
                  {segment.label}
                </span>
                <span className="tabular-nums text-zinc-500">
                  <strong className="font-semibold text-zinc-800">{segment.count}</strong>{' '}
                  · {Math.round(segment.percent)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="report-section overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-zinc-900">Detalle por categoría</h2>
          <p className="mt-0.5 text-[11px] text-zinc-500">
            Totales exactos para la presentación.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                <th className="px-4 py-2.5">Categoría</th>
                <th className="px-3 py-2.5 text-right">Total</th>
                <th className="px-3 py-2.5 text-right">Cerrados</th>
                <th className="px-3 py-2.5 text-right">En proceso</th>
                <th className="px-3 py-2.5 text-right">Sin contactar</th>
                <th className="px-3 py-2.5 text-right">Descartados</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map((category) => (
                <tr key={category.value}>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex items-center gap-2 font-medium text-zinc-700">
                      <span className={`h-2 w-2 rounded-full ${category.dotClassName}`} />
                      {category.label}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-zinc-900">
                    {category.total}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                    {category.closed}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">
                    {category.inProgress}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                    {category.notContacted}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                    {category.discarded}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-200 bg-zinc-50 font-semibold text-zinc-800">
                <td className="px-4 py-2.5">Total</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{totals.total}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
                  {totals.closed}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-sky-700">
                  {totals.inProgress}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-amber-700">
                  {totals.notContacted}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500">
                  {totals.discarded}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {discardedWithReasons.length > 0 ? (
        <section className="report-section rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900">
                Clientes descartados
              </h2>
              <p className="mt-0.5 text-[11px] text-zinc-500">
                Motivo registrado en la última nota del caso · No incluye Entrantes.
              </p>
            </div>
            <span className="w-fit rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-zinc-600">
              {discardedWithReasons.length}
            </span>
          </div>

          {discardedWithReason.length > 0 ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {discardedWithReason.map((item) => {
                const category = CATEGORY_BY_VALUE[item.category];

                return (
                  <article
                    key={item.id}
                    className="break-inside-avoid rounded-xl border border-zinc-200 bg-zinc-50/60 p-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          category?.dotClassName || 'bg-zinc-400'
                        }`}
                      />
                      <span
                        className={`text-[10px] font-semibold uppercase tracking-wide ${
                          category?.textClassName || 'text-zinc-600'
                        }`}
                      >
                        {category?.label || item.category}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs font-semibold text-zinc-900">
                      {item.client?.fullName || 'Cliente sin nombre'}
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-zinc-600">
                      {item.reason}
                    </p>
                  </article>
                );
              })}
            </div>
          ) : null}

          {discardedWithoutReason.length > 0 ? (
            <div className="break-inside-avoid mt-4 rounded-xl border border-dashed border-amber-200 bg-amber-50/70 p-3">
              <p className="text-[11px] font-semibold text-amber-800">
                Sin motivo registrado ({discardedWithoutReason.length})
              </p>
              <ul className="mt-1.5 space-y-1 text-[11px] text-amber-800">
                {discardedWithoutReason.map((item) => {
                  const category = CATEGORY_BY_VALUE[item.category];

                  return (
                    <li key={item.id}>
                      {item.client?.fullName || 'Cliente sin nombre'}
                      {category?.label ? ` · ${category.label}` : ''}
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer className="report-section flex flex-col gap-2 border-t border-zinc-200 pt-3 text-[10px] text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
        <p>
          Cerrados = documentos enviados. No incluye Entrantes. Pendientes totales = En
          proceso + Sin contactar.
        </p>
        <p className="no-print inline-flex items-center gap-1">
          <Download className="h-3 w-3" />
          Usa «Descargar PDF» y elige «Guardar como PDF».
        </p>
      </footer>
    </main>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3.5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-semibold leading-none tabular-nums ${accent}`}>
        {value}
      </p>
    </div>
  );
}
