// src/lib/case-stages.js
export const CASE_STAGES = [
  { value: 'SIN_CONTACTAR', label: 'Sin contactar' },
  { value: 'EN_SEGUIMIENTO', label: 'En seguimiento' },
  { value: 'PUNTOS_COMPLETOS', label: 'Puntos completos' },
  { value: 'BUSCANDO_PLAN', label: 'Buscando plan' },
  { value: 'ESPERANDO_FIRMA', label: 'Esperando firma' },
  { value: 'CERRADO_DOCS_ENVIADOS', label: 'Cerrado · Docs enviados' },
  { value: 'DESCARTADO', label: 'Descartado' },
];

export const CASE_STAGE_BY_VALUE = Object.fromEntries(
  CASE_STAGES.map((stage) => [stage.value, stage])
);

export const CLOSED_STAGES = ['DESCARTADO', 'CERRADO_DOCS_ENVIADOS'];
