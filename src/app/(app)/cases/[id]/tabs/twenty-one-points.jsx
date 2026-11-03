'use client';

// src/app/(app)/cases/[id]/tabs/twenty-one-points.jsx
import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, LoaderCircle, Save } from 'lucide-react';
import { saveTwentyOnePointsAction } from '@/app/actions/caseDetailActions';

const FIELDS = [
  { key: 'nombreApellido', label: '1. Nombre y apellido', type: 'text', placeholder: 'Nombre completo' },
  { key: 'dob', label: '2. Fecha de nacimiento', type: 'text', placeholder: 'MM/DD/AAAA' },
  {
    key: 'direccionZc',
    label: '3. Dirección y código postal',
    type: 'text',
    placeholder: 'Calle, ciudad, estado y ZIP',
    full: true,
  },
  { key: 'telefono', label: '4. Teléfono', type: 'text', placeholder: '(000) 000-0000' },
  { key: 'email', label: '5. Correo electrónico', type: 'email', placeholder: 'correo@ejemplo.com' },
  {
    key: 'idioma',
    label: '6. Idioma preferido',
    type: 'select',
    options: ['Español', 'Inglés', 'Otro'],
  },
  {
    key: 'estadoCivil',
    label: '7. Estado civil',
    type: 'select',
    options: ['Soltero(a)', 'Casado(a)', 'Divorciado(a)', 'Viudo(a)', 'Unión libre'],
  },
  { key: 'farmacia', label: '8. Farmacia preferida', type: 'text', placeholder: 'Nombre y ciudad' },
  { key: 'medicoPrimario', label: '9. Médico primario (PCP)', type: 'text', placeholder: 'Nombre del PCP' },
  {
    key: 'especialistas',
    label: '10. Especialistas que visita',
    type: 'text',
    placeholder: 'Cardiólogo, endocrinólogo…',
  },
  {
    key: 'condiciones',
    label: '11. Condiciones médicas',
    type: 'textarea',
    placeholder: 'Diagnósticos y condiciones relevantes',
    full: true,
  },
  {
    key: 'medicamentos',
    label: '12. Medicamentos actuales',
    type: 'textarea',
    placeholder: 'Medicamentos, dosis y frecuencia',
    full: true,
  },
  {
    key: 'tieneMedicaid',
    label: '13. ¿Tiene Medicaid?',
    type: 'select',
    options: ['SÍ', 'NO'],
  },
  {
    key: 'lisPaad',
    label: '14. ¿Recibe LIS / PAAD?',
    type: 'select',
    options: ['SÍ', 'NO'],
  },
  { key: 'tipoTrabajoTenia', label: '15. ¿En qué trabajó?', type: 'text', placeholder: 'Ocupación anterior' },
  {
    key: 'programa401k403b',
    label: '16. ¿Tuvo 401K o 403B?',
    type: 'select',
    options: ['SÍ', 'NO', 'NO SABE'],
  },
  {
    key: 'ingresosMensuales',
    label: '17. Ingresos mensuales aprox.',
    type: 'text',
    placeholder: 'Rango o cantidad',
  },
  {
    key: 'queNoCubre',
    label: '18. ¿Qué no cubre su plan actual?',
    type: 'textarea',
    placeholder: 'Medicamentos, especialistas o servicios sin cobertura',
    full: true,
  },
  {
    key: 'razonVenta',
    label: '19. Razón principal de venta',
    type: 'textarea',
    placeholder: 'Motivo por el que el cliente quiere cambiar',
    full: true,
  },
  {
    key: 'interesCambio',
    label: '20. ¿Interesado en cambiar de plan?',
    type: 'select',
    options: ['SÍ', 'NO', 'TAL VEZ'],
  },
  {
    key: 'notasAdicionales',
    label: '21. Notas adicionales / próximos pasos',
    type: 'textarea',
    placeholder: 'Cualquier detalle que deba recordar el equipo',
    full: true,
  },
];

const inputClasses =
  'w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500';

export default function TwentyOnePoints({ caseId, initialValues }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [error, setError] = useState('');

  const lastSavedRef = useRef(JSON.stringify(initialValues));
  const savingRef = useRef(false);

  const persist = useCallback(
    async (payload) => {
      const snapshot = JSON.stringify(payload);

      if (snapshot === lastSavedRef.current) return;
      if (savingRef.current) return;

      savingRef.current = true;
      setSaving(true);
      setError('');

      const result = await saveTwentyOnePointsAction(caseId, payload);

      savingRef.current = false;
      setSaving(false);

      if (!result?.ok) {
        setError(result?.error || 'No se pudieron guardar los puntos.');
        return;
      }

      lastSavedRef.current = snapshot;
      setSavedAt(new Date());
    },
    [caseId]
  );

  useEffect(() => {
    if (saving || error) return;

    const snapshot = JSON.stringify(values);
    if (snapshot === lastSavedRef.current) return;

    const timer = window.setTimeout(() => {
      persist(values);
    }, 900);

    return () => window.clearTimeout(timer);
  }, [values, saving, error, persist]);

  function handleChange(key, value) {
    setValues((previous) => ({ ...previous, [key]: value }));

    if (error) {
      setError('');
    }
  }

  const completed = FIELDS.filter(
    (field) => String(values[field.key] ?? '').trim() !== ''
  ).length;
  const percent = Math.round((completed / FIELDS.length) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            21 Puntos de la llamada
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Se guarda automáticamente. {completed}/21 campos completos.
          </p>
        </div>
        <div className="w-full max-w-xs">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-500 transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div
            key={field.key}
            className={field.full ? 'sm:col-span-2' : undefined}
          >
            <label
              htmlFor={`point-${field.key}`}
              className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              {field.label}
            </label>

            {field.type === 'textarea' ? (
              <textarea
                id={`point-${field.key}`}
                rows={3}
                value={values[field.key] ?? ''}
                onChange={(event) => handleChange(field.key, event.target.value)}
                onBlur={() => persist(values)}
                placeholder={field.placeholder}
                className={inputClasses}
              />
            ) : field.type === 'select' ? (
              <select
                id={`point-${field.key}`}
                value={values[field.key] ?? ''}
                onChange={(event) => handleChange(field.key, event.target.value)}
                onBlur={() => persist(values)}
                className={inputClasses}
              >
                <option value="">Selecciona…</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`point-${field.key}`}
                type={field.type}
                value={values[field.key] ?? ''}
                onChange={(event) => handleChange(field.key, event.target.value)}
                onBlur={() => persist(values)}
                placeholder={field.placeholder}
                className={inputClasses}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div className="min-h-5 text-xs">
          {saving ? (
            <span className="inline-flex items-center gap-1 text-zinc-500 dark:text-zinc-400">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Guardando…
            </span>
          ) : error ? (
            <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
              <AlertCircle className="h-3.5 w-3.5" />
              {error}
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              Guardado a las {savedAt.toLocaleTimeString('es-US', { hour: 'numeric', minute: '2-digit' })}
            </span>
          ) : (
            <span className="text-zinc-400 dark:text-zinc-500">Los cambios se guardan solos.</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setError('');
            persist(values);
          }}
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {saving ? (
            <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          Guardar Puntos
        </button>
      </div>
    </div>
  );
}
