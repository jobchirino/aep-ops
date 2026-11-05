'use server';

// src/app/actions/caseDetailActions.js
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import {
  areAllRequiredDocsChecked,
  calculateValidDocumentDates,
  formatRadiusNote,
} from '@/lib/business-rules';
import { fromZonedInputs, toZonedDateInputs } from '@/lib/datetime';
import { CASE_STAGE_BY_VALUE } from '@/lib/case-stages';
import { CASE_CATEGORY_BY_VALUE } from '@/lib/case-categories';

const DOC_KEYS = ['soa', 'enrollment', 'attestation', 'sou'];

const TWENTY_ONE_POINT_KEYS = [
  'nombreApellido',
  'mbi',
  'dob',
  'direccionZc',
  'telefono',
  'email',
  'idioma',
  'estadoCivil',
  'farmacia',
  'medicoPrimario',
  'especialistas',
  'condiciones',
  'medicamentos',
  'tieneMedicaid',
  'lisPaad',
  'tipoTrabajoTenia',
  'programa401k403b',
  'ingresosMensuales',
  'queNoCubre',
  'razonVenta',
  'interesCambio',
  'notasAdicionales',
];

const THIRTEEN_POINT_KEYS = [
  'name',
  'gender',
  'dob',
  'phone',
  'address',
  'county',
  'mbi',
  'partA',
  'partB',
  'lis',
  'paad',
  'ssn',
  'medicaid',
  'pcp',
  'providerId',
  'primaryCareId',
  'planActual',
  'estrategia',
  'trabajoAnterior',
  'tuvo401k',
];

const QUICK_PRESETS = {
  call_later: {
    content: 'El cliente pidió que lo llamemos más tarde.',
    eventType: 'CALL_ANSWERED',
    stage: 'EN_SEGUIMIENTO',
  },
  comparing: {
    content: 'Se están comparando planes.',
    eventType: 'NOTE',
    stage: 'BUSCANDO_PLAN',
  },
};

async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return user;
}

function sanitizeText(value, maxLength = 2000) {
  return String(value ?? '').slice(0, maxLength);
}

function sanitizePoints(input, allowedKeys) {
  const output = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return output;
  }

  for (const key of allowedKeys) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) continue;

    const value = input[key];

    if (typeof value === 'string') {
      output[key] = value.slice(0, 2000);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      output[key] = String(value);
    }
  }

  return output;
}

async function findCase(caseId) {
  const id = String(caseId || '').trim();

  if (!id) return null;

  return prisma.aepCase.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      client: { select: { mbi: true } },
      category: true,
      stage: true,
      assignedToId: true,
      assignedTo: { select: { id: true, name: true, shortCode: true } },
      lockedByUserId: true,
      lockedByUser: { select: { name: true, shortCode: true } },
    },
  });
}

function revalidateCase(caseId) {
  revalidatePath(`/cases/${caseId}`);
  revalidatePath('/');
}

/**
 * Cambia la etapa del caso y deja un evento de auditoría firmado.
 */
export async function updateStageAction(caseId, nextStage) {
  const user = await requireUser();
  const stageInfo = CASE_STAGE_BY_VALUE[nextStage];

  if (!stageInfo) {
    return { ok: false, error: 'La etapa seleccionada no es válida.' };
  }

  if (nextStage === 'CERRADO_DOCS_ENVIADOS') {
    return {
      ok: false,
      error: 'Usa el cierre de documentos para marcar el caso como Cerrado · Docs enviados.',
    };
  }

  const aepCase = await findCase(caseId);

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  if (aepCase.stage === nextStage) {
    return { ok: true, stage: nextStage };
  }

  try {
    const radiusNote = formatRadiusNote(user.shortCode, `Cambió la etapa a ${stageInfo.label}`);

    await prisma.$transaction([
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { stage: nextStage },
      }),
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'STATUS_CHANGE',
          content: `Cambió la etapa a ${stageInfo.label}`,
          radiusFormattedNote: radiusNote,
        },
      }),
    ]);

    revalidateCase(aepCase.id);

    return { ok: true, stage: nextStage, note: radiusNote };
  } catch (error) {
    console.error('[caseDetailActions] Error al cambiar la etapa:', error);
    return { ok: false, error: 'No se pudo cambiar la etapa. Intenta de nuevo.' };
  }
}

/**
 * Cambia la categoría/tipo del caso y deja un evento de auditoría.
 */
export async function updateCategoryAction(caseId, nextCategory) {
  const user = await requireUser();
  const categoryInfo = CASE_CATEGORY_BY_VALUE[nextCategory];

  if (!categoryInfo) {
    return { ok: false, error: 'La categoría seleccionada no es válida.' };
  }

  const aepCase = await findCase(caseId);

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  if (aepCase.category === nextCategory) {
    return { ok: true, category: nextCategory, label: categoryInfo.label };
  }

  const content = `Cambió la categoría a ${categoryInfo.label}`;
  const radiusFormattedNote = formatRadiusNote(user.shortCode, content);

  try {
    await prisma.$transaction([
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { category: nextCategory },
      }),
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'CATEGORY_CHANGE',
          content,
          radiusFormattedNote,
        },
      }),
    ]);

    revalidateCase(aepCase.id);

    return { ok: true, category: nextCategory, label: categoryInfo.label };
  } catch (error) {
    console.error('[caseDetailActions] Error al cambiar la categoría:', error);
    return { ok: false, error: 'No se pudo cambiar la categoría del caso.' };
  }
}

/**
 * Asigna o reasigna un caso a un agente (o lo deja sin asignar).
 */
export async function assignCaseAction(caseId, agentId) {
  const user = await requireUser();
  const aepCase = await findCase(caseId);

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const normalizedAgentId = agentId ? String(agentId).trim() : null;
  let agent = null;

  if (normalizedAgentId) {
    agent = await prisma.user.findFirst({
      where: { id: normalizedAgentId, role: 'AGENT' },
      select: { id: true, name: true, shortCode: true },
    });

    if (!agent) {
      return { ok: false, error: 'El agente seleccionado no es válido.' };
    }
  }

  if ((aepCase.assignedToId || null) === (agent?.id || null)) {
    return { ok: true, assignedTo: agent };
  }

  const content = agent
    ? `Caso asignado a ${agent.name} (${agent.shortCode})`
    : 'Caso marcado sin asignar';
  const radiusFormattedNote = formatRadiusNote(user.shortCode, content);

  try {
    await prisma.$transaction([
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { assignedToId: agent?.id || null },
      }),
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'ASSIGNMENT',
          content,
          radiusFormattedNote,
        },
      }),
    ]);

    revalidateCase(aepCase.id);

    return { ok: true, assignedTo: agent };
  } catch (error) {
    console.error('[caseDetailActions] Error al asignar el caso:', error);
    return { ok: false, error: 'No se pudo cambiar el agente asignado.' };
  }
}

/**
 * Guarda la fecha de seguimiento como fecha sin hora (12:00 UTC).
 */
export async function setFollowUpDateAction(caseId, dateValue, timeValue) {
  await requireUser();

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const date = String(dateValue || '').trim();
  const time = String(timeValue || '').trim();

  if (!date) {
    if (time) {
      return { ok: false, error: 'Selecciona una fecha para guardar la hora del seguimiento.' };
    }

    try {
      await prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { nextFollowUpAt: null },
      });

      revalidateCase(aepCase.id);

      return { ok: true, nextFollowUpAt: null, date: '', time: '' };
    } catch (error) {
      console.error('[caseDetailActions] Error al limpiar seguimiento:', error);
      return { ok: false, error: 'No se pudo limpiar el seguimiento.' };
    }
  }

  const nextFollowUpAt = fromZonedInputs(date, time || '12:00');

  if (!nextFollowUpAt) {
    return { ok: false, error: 'La fecha u hora de seguimiento no es válida.' };
  }

  try {
    await prisma.aepCase.update({
      where: { id: aepCase.id },
      data: { nextFollowUpAt },
    });

    revalidateCase(aepCase.id);

    const zoned = toZonedDateInputs(nextFollowUpAt);

    return {
      ok: true,
      nextFollowUpAt: nextFollowUpAt.toISOString(),
      date: zoned.date,
      time: zoned.time,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar seguimiento:', error);
    return { ok: false, error: 'No se pudo guardar la fecha de seguimiento.' };
  }
}

/**
 * Bloquea o libera el caso para la llamada en curso.
 */
export async function toggleInCallAction(caseId) {
  const user = await requireUser();
  const aepCase = await findCase(caseId);

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  if (aepCase.lockedByUserId && aepCase.lockedByUserId !== user.id) {
    return {
      ok: false,
      error: `${aepCase.lockedByUser?.name || 'Otro agente'} está trabajando este caso ahora.`,
      lockedByName: aepCase.lockedByUser?.name || 'Otro agente',
    };
  }

  if (aepCase.lockedByUserId === user.id) {
    try {
      await prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { lockedByUserId: null, lockedAt: null },
      });

      revalidateCase(aepCase.id);

      return { ok: true, locked: false };
    } catch (error) {
      console.error('[caseDetailActions] Error al liberar el caso:', error);
      return { ok: false, error: 'No se pudo liberar el caso.' };
    }
  }

  try {
    const radiusNote = formatRadiusNote(user.shortCode, 'Inició llamada / está trabajando el caso');

    const locked = await prisma.$transaction(async (tx) => {
      const result = await tx.aepCase.updateMany({
        where: {
          id: aepCase.id,
          OR: [{ lockedByUserId: null }, { lockedByUserId: user.id }],
        },
        data: {
          lockedByUserId: user.id,
          lockedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return false;
      }

      await tx.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'NOTE',
          content: 'Inició llamada / está trabajando el caso',
          radiusFormattedNote: radiusNote,
        },
      });

      return true;
    });

    if (!locked) {
      const current = await findCase(aepCase.id);

      return {
        ok: false,
        error: `${current?.lockedByUser?.name || 'Otro agente'} está trabajando este caso ahora.`,
        lockedByName: current?.lockedByUser?.name || 'Otro agente',
      };
    }

    revalidateCase(aepCase.id);

    return {
      ok: true,
      locked: true,
      lockedByUserId: user.id,
      lockedByName: user.name,
      lockedAt: new Date().toISOString(),
      note: radiusNote,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al marcar en llamada:', error);
    return { ok: false, error: 'No se pudo marcar el caso en llamada.' };
  }
}

/**
 * Guarda el formulario de 21 puntos en el JSON del caso.
 */
export async function saveTwentyOnePointsAction(caseId, points) {
  await requireUser();

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const sanitizedPoints = sanitizePoints(points, TWENTY_ONE_POINT_KEYS);

  try {
    const mbi = String(sanitizedPoints.mbi || '').trim();
    const updates = [
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { twentyOnePoints: sanitizedPoints },
      }),
    ];

    // Si el cliente no tiene MBI en Radius, guardamos el capturado en la llamada.
    if (mbi && !aepCase.client?.mbi) {
      updates.push(
        prisma.client.update({
          where: { id: aepCase.clientId },
          data: { mbi },
        })
      );
    }

    await prisma.$transaction(updates);

    revalidatePath(`/cases/${aepCase.id}`);

    return {
      ok: true,
      savedAt: new Date().toISOString(),
      total: Object.values(sanitizedPoints).filter((value) => String(value).trim() !== '').length,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar 21 puntos:', error);
    return { ok: false, error: 'No se pudieron guardar los 21 puntos.' };
  }
}

/**
 * Guarda los ajustes manuales de los 13 puntos y sincroniza la estrategia.
 */
export async function saveThirteenPointsAction(caseId, overrides) {
  await requireUser();

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const sanitizedOverrides = sanitizePoints(overrides, THIRTEEN_POINT_KEYS);
  const data = { thirteenPoints: sanitizedOverrides };

  const estrategia = String(sanitizedOverrides.estrategia || '').trim();
  if (estrategia) {
    data.targetPlanName = estrategia.slice(0, 200);
  }

  try {
    await prisma.aepCase.update({
      where: { id: aepCase.id },
      data,
    });

    revalidatePath(`/cases/${aepCase.id}`);

    return { ok: true, savedAt: new Date().toISOString() };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar 13 puntos:', error);
    return { ok: false, error: 'No se pudieron guardar los ajustes de los 13 puntos.' };
  }
}

/**
 * Agrega una nota manual firmada por el usuario en sesión.
 */
export async function addTimelineNoteAction(caseId, content) {
  const user = await requireUser();
  const aepCase = await findCase(caseId);

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const noteContent = sanitizeText(content, 4000).trim();

  if (!noteContent) {
    return { ok: false, error: 'Escribe una nota antes de guardar.' };
  }

  try {
    const radiusFormattedNote = formatRadiusNote(user.shortCode, noteContent);

    await prisma.timelineEvent.create({
      data: {
        caseId: aepCase.id,
        userId: user.id,
        eventType: 'NOTE',
        content: noteContent,
        radiusFormattedNote,
      },
    });

    revalidateCase(aepCase.id);

    return { ok: true, note: radiusFormattedNote, content: noteContent };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar la nota:', error);
    return { ok: false, error: 'No se pudo guardar la nota.' };
  }
}

/**
 * Botones rápidos: registran la nota y mueven el caso a la etapa operativa.
 */
export async function logQuickNoteAction(caseId, preset) {
  const user = await requireUser();
  const presetInfo = QUICK_PRESETS[preset];

  if (!presetInfo) {
    return { ok: false, error: 'Acción rápida no válida.' };
  }

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  try {
    const radiusFormattedNote = formatRadiusNote(user.shortCode, presetInfo.content);

    await prisma.$transaction([
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: presetInfo.eventType,
          content: presetInfo.content,
          radiusFormattedNote,
        },
      }),
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { stage: presetInfo.stage },
      }),
    ]);

    revalidateCase(aepCase.id);

    return {
      ok: true,
      note: radiusFormattedNote,
      content: presetInfo.content,
      stage: presetInfo.stage,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error en la acción rápida:', error);
    return { ok: false, error: 'No se pudo registrar la acción rápida.' };
  }
}

/**
 * Busca un plan en el catálogo de no comisionables por código, nombre o carrier.
 */
export async function searchNonCommissionablePlanAction(query, state) {
  await requireUser();

  const rawQuery = String(query || '').trim();

  if (rawQuery.length < 2) {
    return { ok: false, error: 'Escribe al menos 2 caracteres para buscar.' };
  }

  const normalizedState = String(state || '').trim().toUpperCase();
  const compactQuery = rawQuery
    .toUpperCase()
    .replace(/[|:]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+/g, '');
  const planIdMatch = compactQuery.match(/([HRS]\d{4})-?(\d{3})/);

  const orConditions = [];

  if (planIdMatch) {
    orConditions.push({ planId: `${planIdMatch[1]}-${planIdMatch[2]}` });
    orConditions.push({ rawPlanId: { contains: rawQuery, mode: 'insensitive' } });
  } else {
    orConditions.push({ planId: { contains: compactQuery, mode: 'insensitive' } });
    orConditions.push({ rawPlanId: { contains: rawQuery, mode: 'insensitive' } });
    orConditions.push({ planName: { contains: rawQuery, mode: 'insensitive' } });
    orConditions.push({ carrier: { contains: rawQuery, mode: 'insensitive' } });
  }

  const select = {
    id: true,
    carrier: true,
    year: true,
    state: true,
    planId: true,
    rawPlanId: true,
    planName: true,
    planType: true,
    statusNote: true,
  };

  try {
    let stateMatches = [];

    if (normalizedState) {
      stateMatches = await prisma.nonCommissionablePlan.findMany({
        where: { state: normalizedState, OR: orConditions },
        take: 25,
        orderBy: [{ year: 'desc' }, { carrier: 'asc' }, { planName: 'asc' }],
        select,
      });
    } else {
      stateMatches = await prisma.nonCommissionablePlan.findMany({
        where: { OR: orConditions },
        take: 25,
        orderBy: [{ year: 'desc' }, { state: 'asc' }, { planName: 'asc' }],
        select,
      });
    }

    let otherMatches = [];

    if (normalizedState && stateMatches.length === 0) {
      otherMatches = await prisma.nonCommissionablePlan.findMany({
        where: { OR: orConditions },
        take: 15,
        orderBy: [{ year: 'desc' }, { state: 'asc' }],
        select,
      });
    }

    const otherStates = [...new Set(otherMatches.map((match) => match.state))].slice(0, 8);

    return {
      ok: true,
      query: rawQuery,
      state: normalizedState,
      stateMatches,
      otherMatches,
      otherStates,
      hasStateMatch: stateMatches.length > 0,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al validar el plan:', error);
    return { ok: false, error: 'No se pudo consultar el catálogo de planes.' };
  }
}

function sanitizeChecklist(input) {
  const output = {};

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return output;
  }

  for (const key of DOC_KEYS) {
    output[key] = Boolean(input[key]);
  }

  return output;
}

function toNoonUTC(value) {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)
  );
}

function toDateOnly(value) {
  if (!value) return '';

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toISOString().slice(0, 10);
}

function parseDateOnly(value) {
  const text = String(value || '').trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null;
  }

  const date = new Date(`${text}T12:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayNumber(date) {
  return Math.floor(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000
  );
}

async function computeDocumentDates({ caseId, targetCarrier, clientState }) {
  if (!targetCarrier) {
    return { ok: false, error: 'Confirma la aseguradora antes de calcular las fechas.' };
  }

  if (!clientState) {
    return { ok: false, error: 'El cliente no tiene estado registrado.' };
  }

  const existingCasesForCarrier = await prisma.aepCase.findMany({
    where: {
      id: { not: caseId },
      enrollmentDate: { not: null },
      targetCarrier: { equals: targetCarrier, mode: 'insensitive' },
    },
    select: {
      enrollmentDate: true,
      targetCarrier: true,
      client: { select: { state: true } },
    },
  });

  const { soaDate, enrollmentDate } = calculateValidDocumentDates({
    targetCarrier,
    clientState,
    existingCasesForCarrier,
    baseEnrollmentDate: new Date(),
  });

  const normalizedSoa = toNoonUTC(soaDate);
  const normalizedEnrollment = toNoonUTC(enrollmentDate);

  if (!normalizedSoa || !normalizedEnrollment) {
    return { ok: false, error: 'No se pudieron calcular las fechas de los documentos.' };
  }

  const stateUpper = String(clientState).trim().toUpperCase();
  const hasSameState = existingCasesForCarrier.some(
    (item) => String(item.client?.state || '').trim().toUpperCase() === stateUpper
  );

  const reason =
    existingCasesForCarrier.length === 0
      ? 'first'
      : hasSameState
        ? 'same_state'
        : 'other_state';

  return {
    ok: true,
    soaDate: normalizedSoa,
    enrollmentDate: normalizedEnrollment,
    reason,
  };
}

/**
 * Guarda la aseguradora y el plan nuevo confirmados por el agente.
 */
export async function saveTargetPlanAction(caseId, payload) {
  await requireUser();

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const targetCarrier = sanitizeText(payload?.targetCarrier, 120).trim();
  const targetPlanName = sanitizeText(payload?.targetPlanName, 200).trim();

  try {
    await prisma.aepCase.update({
      where: { id: aepCase.id },
      data: { targetCarrier, targetPlanName },
    });

    revalidatePath(`/cases/${aepCase.id}`);

    return {
      ok: true,
      targetCarrier,
      targetPlanName,
      savedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar el plan objetivo:', error);
    return { ok: false, error: 'No se pudieron guardar los datos del plan.' };
  }
}

/**
 * Guarda el checklist de documentos requerido por la aseguradora.
 */
export async function saveDocsChecklistAction(caseId, checklist) {
  await requireUser();

  const aepCase = await findCase(caseId);
  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const sanitizedChecklist = sanitizeChecklist(checklist);

  try {
    await prisma.aepCase.update({
      where: { id: aepCase.id },
      data: { docsChecklist: sanitizedChecklist },
    });

    revalidatePath(`/cases/${aepCase.id}`);

    return { ok: true, checklist: sanitizedChecklist };
  } catch (error) {
    console.error('[caseDetailActions] Error al guardar el checklist:', error);
    return { ok: false, error: 'No se pudo guardar el checklist de documentos.' };
  }
}

/**
 * Calcula y guarda SOA / Enrollment respetando 48h y las reglas por estado.
 */
export async function calculateDocumentDatesAction(caseId) {
  await requireUser();

  const aepCase = await prisma.aepCase.findUnique({
    where: { id: String(caseId || '').trim() },
    select: {
      id: true,
      targetCarrier: true,
      client: { select: { state: true } },
    },
  });

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  const targetCarrier = String(aepCase.targetCarrier || '').trim();
  const clientState = String(aepCase.client?.state || '').trim();

  try {
    const computed = await computeDocumentDates({
      caseId: aepCase.id,
      targetCarrier,
      clientState,
    });

    if (!computed.ok) {
      return computed;
    }

    await prisma.aepCase.update({
      where: { id: aepCase.id },
      data: {
        soaDate: computed.soaDate,
        enrollmentDate: computed.enrollmentDate,
      },
    });

    revalidatePath(`/cases/${aepCase.id}`);

    return {
      ok: true,
      soaDate: toDateOnly(computed.soaDate),
      enrollmentDate: toDateOnly(computed.enrollmentDate),
      reason: computed.reason,
    };
  } catch (error) {
    console.error('[caseDetailActions] Error al calcular las fechas:', error);
    return { ok: false, error: 'No se pudieron calcular las fechas de los documentos.' };
  }
}

/**
 * Cierre definitivo: valida checklist + fechas, guarda todo y envía a la etapa final.
 */
export async function closeCaseAction(caseId, payload) {
  const user = await requireUser();

  const aepCase = await prisma.aepCase.findUnique({
    where: { id: String(caseId || '').trim() },
    select: {
      id: true,
      stage: true,
      targetCarrier: true,
      targetPlanName: true,
      docsChecklist: true,
      soaDate: true,
      enrollmentDate: true,
      client: { select: { state: true } },
    },
  });

  if (!aepCase) {
    return { ok: false, error: 'El caso no existe.' };
  }

  if (aepCase.stage === 'CERRADO_DOCS_ENVIADOS') {
    return { ok: false, error: 'Este caso ya está cerrado y enviado.' };
  }

  const targetCarrier = sanitizeText(
    payload?.targetCarrier ?? aepCase.targetCarrier,
    120
  ).trim();
  const targetPlanName = sanitizeText(
    payload?.targetPlanName ?? aepCase.targetPlanName,
    200
  ).trim();
  const checklist = sanitizeChecklist(payload?.checklist ?? aepCase.docsChecklist ?? {});

  if (!targetCarrier) {
    return { ok: false, error: 'Confirma la aseguradora antes de cerrar el caso.' };
  }

  if (!targetPlanName) {
    return { ok: false, error: 'Confirma el plan nuevo antes de cerrar el caso.' };
  }

  if (!areAllRequiredDocsChecked(targetCarrier, checklist)) {
    return {
      ok: false,
      error: 'Marca todos los documentos requeridos por la aseguradora antes de cerrar.',
    };
  }

  const clientState = String(aepCase.client?.state || '').trim();
  const soaDate = parseDateOnly(payload?.soaDate || toDateOnly(aepCase.soaDate));
  const enrollmentDate = parseDateOnly(
    payload?.enrollmentDate || toDateOnly(aepCase.enrollmentDate)
  );

  if (!soaDate || !enrollmentDate) {
    return { ok: false, error: 'Calcula las fechas de SOA y Enrollment antes de cerrar.' };
  }

  if (dayNumber(enrollmentDate) - dayNumber(soaDate) !== 2) {
    return {
      ok: false,
      error: 'La fecha del SOA debe ser exactamente 2 días antes del Enrollment.',
    };
  }

  const computed = await computeDocumentDates({
    caseId: aepCase.id,
    targetCarrier,
    clientState,
  });

  if (!computed.ok) {
    return computed;
  }

  if (
    toDateOnly(computed.soaDate) !== toDateOnly(soaDate) ||
    toDateOnly(computed.enrollmentDate) !== toDateOnly(enrollmentDate)
  ) {
    return {
      ok: false,
      error: 'Las fechas cambiaron. Vuelve a calcular antes de cerrar el caso.',
    };
  }

  const content = 'Documentos completados y enviados a Tatiana por chat';
  const radiusFormattedNote = formatRadiusNote(user.shortCode, content);

  try {
    await prisma.$transaction([
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: {
          stage: 'CERRADO_DOCS_ENVIADOS',
          targetCarrier,
          targetPlanName,
          docsChecklist: checklist,
          docsReady: true,
          soaDate,
          enrollmentDate,
          sentByTatiana: true,
          sentAt: new Date(),
        },
      }),
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'DOCS_READY',
          content,
          radiusFormattedNote,
        },
      }),
    ]);

    revalidatePath('/');
    revalidatePath(`/cases/${aepCase.id}`);
  } catch (error) {
    console.error('[caseDetailActions] Error al cerrar el caso:', error);
    return { ok: false, error: 'No se pudo cerrar el caso. Intenta de nuevo.' };
  }

  redirect('/');
}
