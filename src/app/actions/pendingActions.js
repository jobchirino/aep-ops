'use server';

// src/app/actions/pendingActions.js
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { formatRadiusNote } from '@/lib/business-rules';

/**
 * Marca como completado el seguimiento pendiente de un caso.
 * No cambia la etapa; solo limpia la fecha y deja el evento firmado.
 */
export async function completeFollowUpAction(formData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const caseId = String(formData.get('caseId') || '').trim();

  if (!caseId) {
    return;
  }

  const aepCase = await prisma.aepCase.findUnique({
    where: { id: caseId },
    select: { id: true, nextFollowUpAt: true },
  });

  if (!aepCase || !aepCase.nextFollowUpAt) {
    return;
  }

  const content = 'Seguimiento marcado como completado';

  try {
    await prisma.$transaction([
      prisma.aepCase.update({
        where: { id: aepCase.id },
        data: { nextFollowUpAt: null },
      }),
      prisma.timelineEvent.create({
        data: {
          caseId: aepCase.id,
          userId: user.id,
          eventType: 'NOTE',
          content,
          radiusFormattedNote: formatRadiusNote(user.shortCode, content),
        },
      }),
    ]);

    revalidatePath('/');
    revalidatePath('/pendientes');
    revalidatePath(`/cases/${aepCase.id}`);
  } catch (error) {
    console.error('[pendingActions] Error al completar el seguimiento:', error);
  }
}
