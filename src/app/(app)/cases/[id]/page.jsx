// src/app/(app)/cases/[id]/page.jsx
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAgents } from '@/lib/users';
import { formatTimelineDateTime, toZonedDateInputs } from '@/lib/datetime';
import CaseHeader from './case-header';
import CaseWorkspace from './case-workspace';
import NoteComposer from './note-composer';
import TimelineList from './timeline-list';

export const instant = false;

function toDateInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export default async function CaseDetailPage({ params }) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const { id } = await params;

  const [aepCase, agents] = await Promise.all([
    prisma.aepCase.findUnique({
      where: { id },
      include: {
        client: true,
        assignedTo: { select: { id: true, name: true, shortCode: true, role: true } },
        lockedByUser: { select: { id: true, name: true, shortCode: true } },
        timeline: {
          take: 200,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, shortCode: true, role: true } } },
        },
      },
    }),
    getAgents(),
  ]);

  if (!aepCase) {
    notFound();
  }

  const followUp = toZonedDateInputs(aepCase.nextFollowUpAt);

  const clientData = {
    fullName: aepCase.client?.fullName || '',
    dob: aepCase.client?.dob || '',
    gender: aepCase.client?.gender || '',
    phone: aepCase.client?.phone || '',
    cell: aepCase.client?.cell || '',
    email: aepCase.client?.email || '',
    address: aepCase.client?.address || '',
    city: aepCase.client?.city || '',
    state: aepCase.client?.state || '',
    zip: aepCase.client?.zip || '',
    county: aepCase.client?.county || '',
    mbi: aepCase.client?.mbi || '',
    ssn: aepCase.client?.ssn || '',
    medicaidNumber: aepCase.client?.medicaidNumber || '',
    memberId: aepCase.client?.memberId || '',
    partADate: aepCase.client?.partADate || '',
    partBDate: aepCase.client?.partBDate || '',
    lis: aepCase.client?.lis || 'NO',
    paad: aepCase.client?.paad || 'NO',
    radiusUrl: aepCase.client?.radiusUrl || '',
    rawPoliciesJson: aepCase.client?.rawPoliciesJson || [],
    source: aepCase.client?.source || 'RADIUS',
    leadStatus: aepCase.client?.leadStatus || '',
    leadTemperature: aepCase.client?.leadTemperature || '',
    leadTags: aepCase.client?.leadTags || '',
    leadAssignedUser: aepCase.client?.leadAssignedUser || '',
  };

  const caseData = {
    id: aepCase.id,
    category: aepCase.category,
    stage: aepCase.stage,
    currentCarrier: aepCase.currentCarrier || '',
    currentPlanName: aepCase.currentPlanName || '',
    currentPlanId: aepCase.currentPlanId || '',
    policyId: aepCase.policyId || '',
    effectiveDate: aepCase.effectiveDate || '',
    terminationDate: aepCase.terminationDate || '',
    radiusStatus: aepCase.radiusStatus || '',
    eligibleHorizonCsnp: Boolean(aepCase.eligibleHorizonCsnp),
    actionRequired: aepCase.actionRequired || '',
    nextFollowUpDate: followUp.date,
    nextFollowUpTime: followUp.time,
    twentyOnePoints: aepCase.twentyOnePoints || {},
    thirteenPoints: aepCase.thirteenPoints || {},
    targetCarrier: aepCase.targetCarrier || '',
    targetPlanName: aepCase.targetPlanName || '',
    targetPlanId: aepCase.targetPlanId || '',
    targetEffDate: aepCase.targetEffDate || '01/01/2027',
    enrollmentPeriod: aepCase.enrollmentPeriod || 'AEP',
    citaStatus: aepCase.citaStatus || 'NO',
    caseNotesSummary: aepCase.caseNotesSummary || '',
    docsChecklist: aepCase.docsChecklist || {},
    docsReady: Boolean(aepCase.docsReady),
    soaDate: toDateInputValue(aepCase.soaDate),
    enrollmentDate: toDateInputValue(aepCase.enrollmentDate),
    sentAt: aepCase.sentAt ? toZonedDateInputs(aepCase.sentAt).date : '',
    assignedTo: aepCase.assignedTo,
    lockedByUser: aepCase.lockedByUser,
    lockedAt: aepCase.lockedAt ? aepCase.lockedAt.toISOString() : null,
  };

  const events = aepCase.timeline.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    content: event.content,
    radiusFormattedNote: event.radiusFormattedNote || '',
    createdAtLabel: formatTimelineDateTime(event.createdAt),
    user: event.user,
  }));

  return (
    <div className="space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Volver al dashboard
      </Link>

      <CaseHeader
        key={`header-${caseData.id}`}
        aepCase={caseData}
        client={clientData}
        currentUser={user}
        agents={agents}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,380px)] xl:grid-cols-[minmax(0,1fr)_400px]">
        <CaseWorkspace key={`workspace-${caseData.id}`} aepCase={caseData} client={clientData} />

        <div className="space-y-4">
          <NoteComposer key={`composer-${caseData.id}`} caseId={caseData.id} />
          <TimelineList events={events} />
        </div>
      </div>
    </div>
  );
}
