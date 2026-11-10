// src/lib/business-rules.js

import { formatRadiusNoteDate } from '@/lib/datetime';

// Año oficial del catálogo de planes no comisionables que valida la aplicación.
// Los registros de años anteriores se conservan solo como histórico.
export const NON_COMMISSIONABLE_PLAN_YEAR = 2027;

/**
 * 1. Devuelve la estructura de documentos requeridos según la aseguradora.
 * Clover exige 4 documentos; las demás exigen SOA y Enrollment.
 */
export function getRequiredDocsForCarrier(carrierName, currentChecklist = {}) {
  const isClover = String(carrierName || '').toUpperCase().includes('CLOVER');

  if (isClover) {
    return {
      isClover: true,
      items: [
        { key: 'soa', label: 'Scope of Appointment (SOA)', checked: Boolean(currentChecklist?.soa) },
        { key: 'enrollment', label: 'Enrollment Application', checked: Boolean(currentChecklist?.enrollment) },
        { key: 'attestation', label: 'Attestation Form (Clover)', checked: Boolean(currentChecklist?.attestation) },
        { key: 'sou', label: 'Statement of Understanding (Clover)', checked: Boolean(currentChecklist?.sou) },
      ],
    };
  }

  return {
    isClover: false,
    items: [
      { key: 'soa', label: 'Scope of Appointment (SOA)', checked: Boolean(currentChecklist?.soa) },
      { key: 'enrollment', label: 'Enrollment Application', checked: Boolean(currentChecklist?.enrollment) },
    ],
  };
}

export function areAllRequiredDocsChecked(carrierName, checklist = {}) {
  const { items } = getRequiredDocsForCarrier(carrierName, checklist);
  return items.every((item) => item.checked === true);
}

/**
 * 2. Calcula automáticamente las fechas válidas de SOA y Enrollment según las reglas de documentos:
 * - Regla 1: Fecha del SOA = 48 horas (2 días) antes de la fecha del Enrollment.
 * - Regla 2: Mismo estado y misma compañía -> pueden llevar la misma fecha.
 *            Misma compañía en OTRO estado -> debe ser 1 día después (+1 día) del cliente anterior.
 */
export function calculateValidDocumentDates({ targetCarrier, clientState, existingCasesForCarrier = [], baseEnrollmentDate = new Date() }) {
  const stateUpper = String(clientState || '').trim().toUpperCase();
  const carrierUpper = String(targetCarrier || '').trim().toUpperCase();

  let candidateEnrollment = new Date(baseEnrollmentDate);
  candidateEnrollment.setHours(12, 0, 0, 0);

  // Filtrar casos que ya tienen fecha de Enrollment asignada para esta aseguradora
  const validExisting = existingCasesForCarrier
    .filter((c) => c.enrollmentDate && String(c.targetCarrier || '').trim().toUpperCase() === carrierUpper)
    .sort((a, b) => new Date(b.enrollmentDate) - new Date(a.enrollmentDate));

  if (validExisting.length > 0) {
    // ¿Existe ya un caso de la misma compañía y el mismo estado?
    const sameStateCase = validExisting.find(
      (c) => String(c.client?.state || '').trim().toUpperCase() === stateUpper
    );

    if (sameStateCase) {
      // Mismo estado y misma compañía: pueden compartir la misma fecha
      candidateEnrollment = new Date(sameStateCase.enrollmentDate);
    } else {
      // Misma compañía pero en OTRO estado: 1 día después del último cliente de esa compañía
      const latestCase = validExisting[0];
      const latestDate = new Date(latestCase.enrollmentDate);
      latestDate.setDate(latestDate.getDate() + 1);
      if (latestDate > candidateEnrollment) {
        candidateEnrollment = latestDate;
      }
    }
  }

  // SOA siempre 48 horas (2 días) antes del Enrollment
  const soaDate = new Date(candidateEnrollment);
  soaDate.setDate(soaDate.getDate() - 2);

  return {
    soaDate,
    enrollmentDate: candidateEnrollment,
  };
}

/**
 * Valida una fecha de Enrollment ingresada manualmente.
 * Mantiene la regla de +1 día cuando la misma aseguradora ya tiene
 * un caso en otro estado y no existe todavía un caso en el estado actual.
 */
export function validateManualEnrollmentDate({
  targetCarrier,
  clientState,
  enrollmentDate,
  existingCasesForCarrier = [],
}) {
  const carrier = String(targetCarrier || '').trim();
  const state = String(clientState || '').trim().toUpperCase();

  if (!carrier) {
    return { ok: false, error: 'Confirma la aseguradora antes de validar la fecha.' };
  }

  if (!state) {
    return { ok: false, error: 'El cliente no tiene estado registrado.' };
  }

  if (!enrollmentDate || Number.isNaN(new Date(enrollmentDate).getTime())) {
    return { ok: false, error: 'La fecha de Enrollment no es válida.' };
  }

  const carrierUpper = carrier.toUpperCase();
  const validExisting = existingCasesForCarrier.filter(
    (item) =>
      item.enrollmentDate &&
      String(item.targetCarrier || '').trim().toUpperCase() === carrierUpper
  );

  const hasSameState = validExisting.some(
    (item) => String(item.client?.state || '').trim().toUpperCase() === state
  );

  if (hasSameState) {
    return { ok: true };
  }

  const otherStateCases = validExisting.filter(
    (item) => String(item.client?.state || '').trim().toUpperCase() !== state
  );

  if (otherStateCases.length === 0) {
    return { ok: true };
  }

  const latest = otherStateCases.reduce((current, item) => {
    const date = new Date(item.enrollmentDate);
    return date > current ? date : current;
  }, new Date(0));

  const minimum = new Date(latest);
  minimum.setUTCDate(minimum.getUTCDate() + 1);

  if (new Date(enrollmentDate).getTime() < minimum.getTime()) {
    const minimumLabel = `${String(minimum.getUTCMonth() + 1).padStart(2, '0')}/${String(
      minimum.getUTCDate()
    ).padStart(2, '0')}/${minimum.getUTCFullYear()}`;

    return {
      ok: false,
      error: `Para ${carrier} en ${state}, la fecha mínima de Enrollment es ${minimumLabel} porque ya hay un caso de esa aseguradora en otro estado.`,
    };
  }

  return { ok: true };
}

/**
 * 3. Genera el bloque de texto exacto de los 13 Puntos combinando Radius + 21 Puntos + Estrategia
 */
export function generateThirteenPointsText(client, aepCase) {
  const p21 = aepCase?.twentyOnePoints || {};
  const p13 = aepCase?.thirteenPoints || {};

  const name = p13.name || p21.nombreApellido || client?.fullName || '';
  const gender = (p13.gender || client?.gender || '').toUpperCase();
  const dob = p13.dob || p21.dob || client?.dob || '';
  const phone = p13.phone || client?.phone || client?.cell || '';
  const fullAddress =
    p13.address ||
    p21.direccionZc ||
    [client?.address, client?.city, client?.state, client?.zip].filter(Boolean).join(' ');
  const county = (p13.county || client?.county || '').toUpperCase();
  const mbi = p13.mbi || p21.mbi || client?.mbi || '';
  const partA = p13.partA || client?.partADate || '';
  const partB = p13.partB || client?.partBDate || '';
  const lis = p13.lis || client?.lis || 'NO';
  const paad = p13.paad || client?.paad || 'NO';
  const ssn = p13.ssn || client?.ssn || '';
  const medicaid = p13.medicaid || client?.medicaidNumber || '';
  const pcp = p13.pcp || p21.medicoPrimario || '';
  const npi = p13.providerId || p13.primaryCareId || '';
  const currentPlan = p13.planActual || aepCase?.currentPlanName || '';
  const strategy = p13.estrategia || aepCase?.targetPlanName || '';
  const effDate = aepCase?.targetEffDate || '01/01/2027';
  const cita = aepCase?.citaStatus || 'NO';
  const notas =
    aepCase?.caseNotesSummary ||
    (aepCase?.category === 'NO_COMISIONABLE'
      ? 'RW - Cambio Plan (plan No comisionable 2027)'
      : aepCase?.category === 'NO_RENOVABLE'
      ? 'RW - Cambio Plan (plan No renovable 2027)'
      : aepCase?.category === 'ENTRANTE'
      ? 'RW - Cambio de Plan (cliente entrante)'
      : 'RW - Recuperación Cliente Cancelado');
  const periodo = aepCase?.enrollmentPeriod || 'AEP';
  const trabajoAnterior = p21.tipoTrabajoTenia || p13.trabajoAnterior || '';
  const tuvo401k = p21.programa401k403b || p13.tuvo401k || 'NO';

  const lines = [
    `NAME ${name}`,
    `GENDER ${gender}`,
    `DOB ${dob}`,
    `PHONE ${phone}`,
    `ADDRESS ${fullAddress}`,
    `COUNTY ${county}`,
    `MBI# ${mbi}`,
    `PART A ${partA}`,
    `PART B ${partB}`,
    `LIS ${lis}`,
    `PAAD ${paad}`,
    `SS# ${ssn}`,
    `MEDICAID# ${medicaid}`,
    `PCP ${pcp}`,
    ...(npi ? [`NPI ${npi}`] : []),
    `PLAN ACTUAL ${currentPlan}`,
    `ESTRATEGIA ${strategy}`,
    `EFF DATE ${effDate}`,
    `CITA ${cita}`,
    `NOTAS ${notas}`,
    `PERIODO DE ENROLAMIENTO ${periodo}`,
    `PENSIONES ¿En qué trabajó?: ${trabajoAnterior}`,
    `¿Tuvo 401K o 403B?: ${tuvo401k}`,
  ];

  return lines.map((line) => line.trimEnd()).join('\n').trim();
}

/**
 * 4. Formatea automáticamente una nota firmada con el usuario en sesión para pegar en RadiusBob
 */
export function formatRadiusNote(userShortCode, actionText) {
  return `${formatRadiusNoteDate()} ${userShortCode}: ${actionText}`;
}