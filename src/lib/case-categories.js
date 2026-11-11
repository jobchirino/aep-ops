// src/lib/case-categories.js
export const CASE_CATEGORIES = [
  { value: 'NO_RENOVABLE', label: 'No renovable' },
  { value: 'NO_COMISIONABLE', label: 'No comisionable' },
  { value: 'CLOVER_REENROLL', label: 'Clover ReEnroll' },
  { value: 'CANCELADO', label: 'Cancelado' },
  { value: 'ENTRANTE', label: 'Entrante / Cambio de plan' },
];

export const CASE_CATEGORY_BY_VALUE = Object.fromEntries(
  CASE_CATEGORIES.map((category) => [category.value, category])
);

// Las aplicaciones Entrantes / Cambio de plan no cuentan para la meta de 50.
export const GOAL_EXCLUDED_CATEGORY = 'ENTRANTE';
