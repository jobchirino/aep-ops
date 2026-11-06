// src/lib/queries.js
import { prisma } from '@/lib/prisma';
import { CLOSED_STAGES } from '@/lib/case-stages';
import { getTodayRangeUtc } from '@/lib/datetime';

/**
 * Seguimientos del usuario en sesión (asignados a él o sin asignar):
 * - overdue: ya pasó su fecha/hora.
 * - today: todavía quedan por atender hoy (hora de New Jersey).
 * Devuelve null si la consulta falla, para que el header no se rompa.
 */
export async function getPendingTodayCount(user) {
  if (!user?.id) {
    return { overdue: 0, today: 0, total: 0 };
  }

  const now = new Date();
  const { end } = getTodayRangeUtc(now);

  const baseWhere = {
    stage: { notIn: CLOSED_STAGES },
    AND: [{ OR: [{ assignedToId: user.id }, { assignedToId: null }] }],
  };

  try {
    const [overdue, today] = await Promise.all([
      prisma.aepCase.count({
        where: {
          ...baseWhere,
          nextFollowUpAt: { lt: now },
        },
      }),
      prisma.aepCase.count({
        where: {
          ...baseWhere,
          nextFollowUpAt: { gte: now, lte: end },
        },
      }),
    ]);

    return { overdue, today, total: overdue + today };
  } catch (error) {
    console.error('[queries] No se pudieron contar los seguimientos:', error);
    return null;
  }
}

/**
 * Lista de seguimientos pendientes del usuario en sesión:
 * casos no cerrados, con próxima fecha y asignados a él o sin agente.
 */
export async function getPendingCases(user) {
  if (!user?.id) {
    return [];
  }

  try {
    return await prisma.aepCase.findMany({
      where: {
        stage: { notIn: CLOSED_STAGES },
        nextFollowUpAt: { not: null },
        OR: [{ assignedToId: user.id }, { assignedToId: null }],
      },
      orderBy: { nextFollowUpAt: 'asc' },
      take: 300,
      select: {
        id: true,
        stage: true,
        category: true,
        nextFollowUpAt: true,
        currentPlanName: true,
        currentCarrier: true,
        assignedTo: {
          select: { id: true, name: true, shortCode: true },
        },
        client: {
          select: {
            fullName: true,
            state: true,
            phone: true,
            cell: true,
            radiusUrl: true,
          },
        },
      },
    });
  } catch (error) {
    console.error('[queries] No se pudieron cargar los pendientes:', error);
    return [];
  }
}
