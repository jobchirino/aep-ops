// src/lib/queries.js
import { prisma } from '@/lib/prisma';
import { CLOSED_STAGES } from '@/lib/case-stages';

function endOfToday() {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Pendientes de hoy:
 * - Casos en una etapa abierta.
 * - Con nextFollowUpAt vencido o dentro del día de hoy.
 * - Sus casos asignados + los que aún no tienen agente.
 * Devuelve null si la consulta falla, para que el header no se rompa.
 */
export async function getPendingTodayCount(user) {
  if (!user?.id) return 0;

  const where = {
    stage: { notIn: CLOSED_STAGES },
    nextFollowUpAt: { lte: endOfToday() },
    AND: [{ OR: [{ assignedToId: user.id }, { assignedToId: null }] }],
  };

  try {
    return await prisma.aepCase.count({ where });
  } catch (error) {
    console.error('[queries] No se pudieron contar los pendientes de hoy:', error);
    return null;
  }
}
