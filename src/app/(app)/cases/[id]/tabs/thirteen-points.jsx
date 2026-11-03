'use client';

// src/app/(app)/cases/[id]/tabs/thirteen-points.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ClipboardCheck,
  ClipboardCopy,
  LoaderCircle,
  Save,
  Sparkles,
} from 'lucide-react';
import { generateThirteenPointsText } from '@/lib/business-rules';
import { saveThirteenPointsAction } from '@/app/actions/caseDetailActions';
import { copyTextToClipboard } from '@/lib/clipboard';

const BRIDGE_FIELDS = [
  { key: 'name', label: 'Nombre completo' },
  { key: 'phone', label: 'Teléfono' },
  { key: 'address', label: 'Dirección completa', full: true },
  { key: 'county', label: 'Condado' },
  { key: 'pcp', label: 'Médico primario (PCP)' },
  { key: 'providerId', label: 'ID del proveedor' },
  { key: 'primaryCareId', label: 'Primary Care ID' },
  { key: 'planActual', label: 'Plan actual' },
  { key: 'estrategia', label: 'ESTRATEGIA (plan nuevo)' },
  { key: 'trabajoAnterior', label: 'Trabajo anterior' },
  { key: 'tuvo401k', label: '¿Tuvo 401K / 403B?' },
  { key: 'lis', label: 'LIS' },
  { key: 'paad', label: 'PAAD' },
];

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export default function ThirteenPoints({ caseId, aepCase, client, initialOverrides }) {
  const [overrides, setOverrides] = useState(initialOverrides || {});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState(null);

  const lastSavedRef = useRef(JSON.stringify(initialOverrides || {}));
  const savingRef = useRef(false);

  const generatedText = generateThirteenPointsText(client, {
    ...aepCase,
    thirteenPoints: overrides,
  });

  const persist = useCallback(
    async (payload) => {
      const snapshot = JSON.stringify(payload);

      if (snapshot === lastSavedRef.current) return;
      if (savingRef.current) return;

      savingRef.current = true;
      setSaving(true);
      setError('');

      const result = await saveThirteenPointsAction(caseId, payload);

      savingRef.current = false;
      setSaving(false);

      if (!result?.ok) {
        setError(result?.error || 'No se pudieron guardar los ajustes.');
        return;
      }

      lastSavedRef.current = snapshot;
      setSavedAt(new Date());
    },
    [caseId]
  );

  useEffect(() => {
    if (saving || error) return;

    const snapshot = JSON.stringify(overrides);
    if (snapshot === lastSavedRef.current) return;

    const timer = window.setTimeout(() => {
      persist(overrides);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [overrides, saving, error, persist]);

  function handleChange(key, value) {
    setOverrides((previous) => ({ ...previous, [key]: value }));

    if (error) {
      setError('');
    }
  }

  async function handleCopy() {
    const copied = await copyTextToClipboard(generatedText);

    setCopyStatus(copied ? 'copied' : 'error');
    window.setTimeout(() => setCopyStatus(null), 3000);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            13 Puntos · Generador vivo
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Se combina Radius + 21 Puntos + los ajustes manuales. Edita y el bloque se actualiza al
            instante.
          </p>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900/30 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {copyStatus === 'copied' ? (
            <ClipboardCheck className="h-4 w-4 text-emerald-400 dark:text-emerald-600" />
          ) : (
            <ClipboardCopy className="h-4 w-4" />
          )}
          {copyStatus === 'copied'
            ? 'Bloque copiado'
            : copyStatus === 'error'
              ? 'No se pudo copiar'
              : '📋 Copiar Bloque para Radius'}
        </button>
      </div>

      <pre className="max-h-[420px] overflow-auto rounded-2xl border border-zinc-800 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-zinc-100 shadow-inner">
        {generatedText}
      </pre>

      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          <Sparkles className="h-3.5 w-3.5" />
          Campos puente editables
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {BRIDGE_FIELDS.map((field) => (
            <div key={field.key} className={field.full ? 'sm:col-span-2' : undefined}>
              <label
                htmlFor={`thirteen-${field.key}`}
                className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500"
              >
                {field.label}
              </label>
              <input
                id={`thirteen-${field.key}`}
                type="text"
                value={overrides[field.key] ?? ''}
                onChange={(event) => handleChange(field.key, event.target.value)}
                onBlur={() => persist(overrides)}
                className={inputClasses}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="min-h-5 text-xs">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Guardando ajustes…
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Ajustes guardados a las{' '}
              {savedAt.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">
              Los ajustes también se guardan solos.
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            persist(overrides);
          }}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar ajustes
        </button>
      </div>
    </div>
  );
}
