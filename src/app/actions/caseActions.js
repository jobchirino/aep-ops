'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatRadiusNote } from '@/lib/business-rules';

const NC_SMS_CONTENT = 'Llamada no contestada, se dejó SMS y Voicemail';
const NC_SMS_RADIUS_ACTION = 'Se llamó y no respondió, se dejó SMS y voicemail';

/**
 * Registra una llamada no contestada + SMS/Voicemail en un caso:
 * - Firma el evento con el usuario en sesión.
 * - Genera la nota lista para pegar en RadiusBob.
 * - Mueve el caso a EN_SEGUIMIENTO.
 * Devuelve la nota para que el cliente la copie al portapapeles.
 */
export async function logNcSmsAction(caseId) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const normalizedCaseId = String(caseId || '').trim();

  if (!normalizedCaseId) {
    return { ok: false, error: 'Caso inválido.' };
  }

  try {
    const aepCase = await prisma.aepCase.findUnique({
      where: { id: normalizedCaseId },
      select: { id: true },
    });

    if (!aepCase) {
      return { ok: false, error: 'El caso no existe.' };
    }

    const radiusFormattedNote = formatRadiusNote(user.shortCode, NC_SMS_RADIUS_ACTION);

    const [, updatedCase] = await prisma.$transaction([
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'SMS_VOICEMAIL',
          content: NC_SMS_CONTENT,
          radiusFormattedNote,
        },
      }),
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { stage: 'EN_SEGUIMIENTO' },
        select: { id: true, stage: true },
      }),
    ]);

    revalidatePath('/');
    revalidatePath(`/cases/${aepCase.id}`);

    return {
      ok: true,
      caseId: updatedCase.id,
      stage: updatedCase.stage,
      note: radiusFormattedNote,
      content: NC_SMS_CONTENT,
    };
  } catch (error) {
    console.error('[caseActions] Error al registrar NC + SMS:', error);
    return { ok: false, error: 'No se pudo registrar la llamada. Intenta de nuevo.' };
  }
}
