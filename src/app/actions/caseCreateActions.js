'use server';

// src/app/actions/caseCreateActions.js
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatRadiusNote } from '@/lib/business-rules';
import { CASE_CATEGORY_BY_VALUE } from '@/lib/case-categories';

function sanitize(value, maxLength = 200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

/**
 * Agrega al AEP un cliente de Radius o un lead ya importado.
 * Bloquea duplicados: un cliente o lead solo puede tener un caso.
 */
export async function createCaseForClientAction(input) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const clientId = sanitize(input?.clientId, 100);

  if (!clientId) {
    return { ok: false, error: 'Cliente inválido.' };
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, fullName: true, source: true },
  });

  if (!client) {
    return { ok: false, error: 'El cliente o lead no existe.' };
  }

  const existingCase = await prisma.aepCase.findFirst({
    where: { clientId: client.id },
    select: { id: true },
  });

  if (existingCase) {
    return {
      ok: false,
      error: 'Este cliente o lead ya tiene un caso AEP.',
      existingCaseId: existingCase.id,
    };
  }

  const category = sanitize(input?.category, 30) || 'ENTRANTE';

  if (!CASE_CATEGORY_BY_VALUE[category]) {
    return { ok: false, error: 'La categoría seleccionada no es válida.' };
  }

  const rawAssignedToId = input?.assignedToId;
  const assignedToId =
    rawAssignedToId === undefined
      ? user.id
      : rawAssignedToId
        ? String(rawAssignedToId)
        : null;

  if (assignedToId) {
    const agent = await prisma.user.findFirst({
      where: { id: assignedToId, role: 'AGENT' },
      select: { id: true },
    });

    if (!agent) {
      return { ok: false, error: 'El agente seleccionado no es válido.' };
    }
  }

  const currentCarrier = sanitize(input?.currentCarrier, 120) || null;
  const currentPlanName = sanitize(input?.currentPlanName, 200) || null;
  const currentPlanId = sanitize(input?.currentPlanId, 50) || null;

  try {
    const newCase = await prisma.aepCase.create({
      data: {
        clientId: client.id,
        category,
        stage: 'SIN_CONTACTAR',
        assignedToId,
        currentCarrier,
        currentPlanName,
        currentPlanId,
        actionRequired: category === 'ENTRANTE' ? 'Cambiar' : null,
      },
      select: { id: true },
    });

    const isLead = client.source === 'LEAD';

    const content = isLead
      ? category === 'ENTRANTE'
        ? 'Lead entrante agregado al AEP desde el directorio de leads'
        : 'Caso creado desde un lead del directorio'
      : category === 'ENTRANTE'
        ? 'Cliente entrante agregado al AEP desde el directorio de clientes'
        : 'Caso creado desde el directorio de clientes';

    await prisma.timelineEvent.create({
      data: {
        caseId: newCase.id,
        userId: user.id,
        eventType: 'NOTE',
        content,
        radiusFormattedNote: formatRadiusNote(user.shortCode, content),
      },
    });

    revalidatePath('/');
    revalidatePath(`/cases/${newCase.id}`);

    return { ok: true, caseId: newCase.id };
  } catch (error) {
    console.error('[caseCreateActions] Error al crear el caso:', error);
    return { ok: false, error: 'No se pudo agregar el cliente al AEP. Intenta de nuevo.' };
  }
}
