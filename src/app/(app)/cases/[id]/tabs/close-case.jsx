'use client';

// src/app/(app)/cases/[id]/tabs/close-case.jsx
import { useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  FolderCheck,
  LoaderCircle,
  Save,
  Zap,
} from 'lucide-react';
import {
  areAllRequiredDocsChecked,
  getRequiredDocsForCarrier,
} from '@/lib/business-rules';
import {
  calculateDocumentDatesAction,
  closeCaseAction,
  saveDocsChecklistAction,
  saveTargetPlanAction,
} from '@/app/actions/caseDetailActions';

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

const REASONS = {
  first: 'Primera aplicación para esta aseguradora: se usa la fecha base.',
  same_state: 'Mismo estado y aseguradora: se reutiliza la fecha de enrollment más reciente.',
  other_state: 'Aseguradora en otro estado: se aplica +1 día sobre el último registro.',
};

function formatDateOnly(value) {
  const text = String(value || '').slice(0, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return '—';
  }

  const [year, month, day] = text.split('-');
  return `${month}/${day}/${year}`;
}

export default function CloseCase({
  caseId,
  aepCase,
  client,
}) {
  const [targetCarrier, setTargetCarrier] = useState(aepCase.targetCarrier || '');
  const [targetPlanName, setTargetPlanName] = useState(aepCase.targetPlanName || '');
  const [checklist, setChecklist] = useState(aepCase.docsChecklist || {});
  const [soaDate, setSoaDate] = useState(aepCase.soaDate || '');
  const [enrollmentDate, setEnrollmentDate] = useState(aepCase.enrollmentDate || '');
  const [datesReason, setDatesReason] = useState('');
  const [datesCarrier, setDatesCarrier] = useState(aepCase.targetCarrier || '');
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [closing, setClosing] = useState(false);
  const [planSavedAt, setPlanSavedAt] = useState(null);
  const [error, setError] = useState('');

  const isClosed = aepCase.stage === 'CERRADO_DOCS_ENVIADOS';
  const requiredDocs = getRequiredDocsForCarrier(targetCarrier, checklist);
  const requiredItems = requiredDocs.items;
  const completedCount = requiredItems.filter((item) => item.checked).length;
  const allChecked = areAllRequiredDocsChecked(targetCarrier, checklist);
  const hasPlanData = Boolean(targetCarrier.trim() && targetPlanName.trim());
  const hasDates = Boolean(soaDate && enrollmentDate);
  const datesStale =
    Boolean(datesCarrier) &&
    targetCarrier.trim().toUpperCase() !== datesCarrier.trim().toUpperCase();

  const canClose =
    !isClosed &&
    hasPlanData &&
    allChecked &&
    hasDates &&
    !datesStale &&
    !savingPlan &&
    !savingChecklist &&
    !calculating &&
    !closing;

  async function savePlan() {
    setSavingPlan(true);
    setError('');

    const result = await saveTargetPlanAction(caseId, {
      targetCarrier,
      targetPlanName,
    });

    setSavingPlan(false);

    if (!result?.ok) {
      setError(result?.error || 'No se pudieron guardar los datos del plan.');
      return false;
    }

    setPlanSavedAt(new Date());
    return true;
  }

  async function toggleDoc(key) {
    const nextChecklist = { ...checklist, [key]: !checklist[key] };
    setChecklist(nextChecklist);
    setSavingChecklist(true);
    setError('');

    const result = await saveDocsChecklistAction(caseId, nextChecklist);

    setSavingChecklist(false);

    if (!result?.ok) {
      setChecklist(checklist);
      setError(result?.error || 'No se pudo guardar el checklist.');
    }
  }

  async function calculateDates() {
    setCalculating(true);
    setError('');

    const saved = await saveTargetPlanAction(caseId, {
      targetCarrier,
      targetPlanName,
    });

    if (!saved?.ok) {
      setCalculating(false);
      setError(saved?.error || 'Confirma la aseguradora y el plan antes de calcular.');
      return;
    }

    setPlanSavedAt(new Date());

    const result = await calculateDocumentDatesAction(caseId);

    setCalculating(false);

    if (!result?.ok) {
      setError(result?.error || 'No se pudieron calcular las fechas.');
      return;
    }

    setSoaDate(result.soaDate);
    setEnrollmentDate(result.enrollmentDate);
    setDatesReason(result.reason || '');
    setDatesCarrier(targetCarrier.trim());
  }

  async function handleClose() {
    if (!canClose) return;

    setClosing(true);
    setError('');

    const result = await closeCaseAction(caseId, {
      targetCarrier,
      targetPlanName,
      checklist,
      soaDate,
      enrollmentDate,
    });

    setClosing(false);

    if (result && !result.ok) {
      setError(result.error || 'No se pudo cerrar el caso.');
    }
  }

  const disabledReason = !hasPlanData
    ? 'Confirma la aseguradora y el plan nuevo.'
    : !allChecked
      ? `Marca los ${requiredItems.length} documentos requeridos.`
      : !hasDates
        ? 'Calcula las fechas de SOA y Enrollment.'
        : datesStale
          ? 'La aseguradora cambió: vuelve a calcular las fechas.'
          : '';

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Cierre y documentos
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Confirma el plan, completa el checklist de la aseguradora y calcula las fechas antes de
          cerrar el caso.
        </p>
      </div>

      {isClosed ? (
        <div className="flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Caso cerrado · documentos enviados a Tatiana.</p>
            <p className="mt-0.5 opacity-90">
              Este caso ya está en la etapa final `CERRADO_DOCS_ENVIADOS`.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="target-carrier"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Aseguradora (targetCarrier)
          </label>
          <input
            id="target-carrier"
            type="text"
            value={targetCarrier}
            onChange={(event) => {
              setTargetCarrier(event.target.value);
              if (error) setError('');
            }}
            onBlur={() => savePlan()}
            placeholder="Clover, Anthem, Humana…"
            className={inputClasses}
          />
        </div>

        <div>
          <label
            htmlFor="target-plan"
            className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            Plan nuevo (targetPlanName)
          </label>
          <input
            id="target-plan"
            type="text"
            value={targetPlanName}
            onChange={(event) => {
              setTargetPlanName(event.target.value);
              if (error) setError('');
            }}
            onBlur={() => savePlan()}
            placeholder="Nombre o código del plan elegido"
            className={inputClasses}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">
          {savingPlan
            ? 'Guardando datos del plan…'
            : planSavedAt
              ? `Datos guardados a las ${planSavedAt.toLocaleTimeString('es-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Los datos del plan se guardan al salir del campo.'}
        </p>

        <button
          type="button"
          onClick={() => savePlan()}
          disabled={savingPlan}
          className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
        >
          {savingPlan ? (
            <LoaderCircle className="h-3 w-3 animate-spin" />
          ) : (
            <Save className="h-3 w-3" />
          )}
          Guardar datos
        </button>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <FolderCheck className="h-3.5 w-3.5" />
            Checklist de documentos
          </div>
          {targetCarrier.trim() ? (
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {requiredDocs.isClover
                ? 'Clover exige 4 documentos'
                : 'Esta aseguradora exige 2 documentos'}{' '}
              · {completedCount}/{requiredItems.length}
            </span>
          ) : null}
        </div>

        {targetCarrier.trim() ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {requiredItems.map((item) => (
              <label
                key={item.key}
                className={`flex cursor-pointer items-start gap-2 rounded-xl border px-3 py-2 text-xs transition ${
                  item.checked
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={item.checked}
                  onChange={() => toggleDoc(item.key)}
                  disabled={savingChecklist || isClosed}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-600"
                />
                <span className="font-medium">{item.label}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
            Confirma la aseguradora para cargar el checklist requerido.
          </p>
        )}
      </div>

      <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3 dark:border-indigo-500/30 dark:bg-indigo-500/5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-indigo-700 dark:text-indigo-300">
              <CalendarCheck2 className="h-3.5 w-3.5" />
              Fechas de documentos
            </p>
            <p className="mt-0.5 text-[10px] text-indigo-600/80 dark:text-indigo-300/70">
              Regla: SOA siempre 2 días (48 h) antes del Enrollment.
            </p>
          </div>

          <button
            type="button"
            onClick={calculateDates}
            disabled={calculating || !targetCarrier.trim() || isClosed}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {calculating ? (
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Zap className="h-3.5 w-3.5" />
            )}
            ⚡ Calcular Fechas (48h/Estados)
          </button>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2 dark:border-indigo-500/30 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              SOA Date
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDateOnly(soaDate)}
            </p>
          </div>
          <div className="rounded-xl border border-indigo-200 bg-white px-3 py-2 dark:border-indigo-500/30 dark:bg-zinc-900">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Enrollment Date
            </p>
            <p className="mt-0.5 text-base font-semibold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatDateOnly(enrollmentDate)}
            </p>
          </div>
        </div>

        {datesReason ? (
          <p className="mt-2 text-[11px] text-indigo-700 dark:text-indigo-300">
            {REASONS[datesReason] || datesReason}
          </p>
        ) : null}

        {datesStale ? (
          <p className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle className="h-3 w-3" />
            La aseguradora cambió. Vuelve a calcular las fechas.
          </p>
        ) : null}

        {!client?.state ? (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-300">
            El cliente no tiene estado registrado; no se puede aplicar la regla por estado.
          </p>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="flex items-start gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : null}

      {!isClosed ? (
        <div className="space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={handleClose}
            disabled={!canClose}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {closing ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            ✅ Marcar Docs Listos y Cerrar Caso
          </button>

          {!canClose && disabledReason ? (
            <p className="text-center text-[10px] text-zinc-400 dark:text-zinc-500">
              {disabledReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
