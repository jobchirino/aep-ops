// src/lib/states.js
// Normaliza estados de EE. UU. y territorios para que "FL", "Florida"
// y "FLORIDA" se traten como el mismo estado.
const STATE_NAMES = {
  AL: 'ALABAMA',
  AK: 'ALASKA',
  AZ: 'ARIZONA',
  AR: 'ARKANSAS',
  CA: 'CALIFORNIA',
  CO: 'COLORADO',
  CT: 'CONNECTICUT',
  DE: 'DELAWARE',
  DC: 'DISTRICT OF COLUMBIA',
  FL: 'FLORIDA',
  GA: 'GEORGIA',
  HI: 'HAWAII',
  ID: 'IDAHO',
  IL: 'ILLINOIS',
  IN: 'INDIANA',
  IA: 'IOWA',
  KS: 'KANSAS',
  KY: 'KENTUCKY',
  LA: 'LOUISIANA',
  ME: 'MAINE',
  MD: 'MARYLAND',
  MA: 'MASSACHUSETTS',
  MI: 'MICHIGAN',
  MN: 'MINNESOTA',
  MS: 'MISSISSIPPI',
  MO: 'MISSOURI',
  MT: 'MONTANA',
  NE: 'NEBRASKA',
  NV: 'NEVADA',
  NH: 'NEW HAMPSHIRE',
  NJ: 'NEW JERSEY',
  NM: 'NEW MEXICO',
  NY: 'NEW YORK',
  NC: 'NORTH CAROLINA',
  ND: 'NORTH DAKOTA',
  OH: 'OHIO',
  OK: 'OKLAHOMA',
  OR: 'OREGON',
  PA: 'PENNSYLVANIA',
  RI: 'RHODE ISLAND',
  SC: 'SOUTH CAROLINA',
  SD: 'SOUTH DAKOTA',
  TN: 'TENNESSEE',
  TX: 'TEXAS',
  UT: 'UTAH',
  VT: 'VERMONT',
  VA: 'VIRGINIA',
  WA: 'WASHINGTON',
  WV: 'WEST VIRGINIA',
  WI: 'WISCONSIN',
  WY: 'WYOMING',
  PR: 'PUERTO RICO',
  VI: 'VIRGIN ISLANDS',
  GU: 'GUAM',
  AS: 'AMERICAN SAMOA',
  MP: 'NORTHERN MARIANA ISLANDS',
};

const STATE_CODE_BY_NAME = Object.fromEntries(
  Object.entries(STATE_NAMES).map(([code, name]) => [name, code])
);

function cleanStatePart(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Devuelve el código de dos letras cuando el valor es un estado reconocido.
 * Si no se reconoce, devuelve el texto limpio para no perder información.
 */
export function normalizeStateCode(value) {
  const text = cleanStatePart(value);

  if (!text) return '';

  if (text === 'ALL' || text === 'ALL STATE' || text === 'ALL STATES') {
    return 'ALL';
  }

  if (STATE_NAMES[text]) return text;

  if (STATE_CODE_BY_NAME[text]) return STATE_CODE_BY_NAME[text];

  return text;
}

/**
 * Separa valores compuestos como "DC, MD" o "IN, KY".
 * "ALL STATES" se convierte en ["ALL"].
 */
export function stateTokens(value) {
  return String(value || '')
    .split(/[,/;|]+/)
    .map((part) => normalizeStateCode(part))
    .filter(Boolean);
}

/**
 * Indica si un estado de plan aplica al estado del cliente.
 * Soporta ALL, ALL STATES y valores compuestos.
 */
export function matchesState(planState, clientState) {
  const clientCode = normalizeStateCode(clientState);

  if (!clientCode) return false;

  const tokens = stateTokens(planState);

  return tokens.includes('ALL') || tokens.includes(clientCode);
}
