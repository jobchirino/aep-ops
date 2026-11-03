'use client';

// src/app/(app)/cases/[id]/case-workspace.jsx
import { ClipboardList, FileText, FolderCheck, ScrollText, ShieldAlert } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import TwentyOnePoints from './tabs/twenty-one-points';
import ThirteenPoints from './tabs/thirteen-points';
import PlanValidator from './tabs/plan-validator';
import PoliciesTab from './tabs/policies-tab';
import CloseCase from './tabs/close-case';

function mergePrefill(prefill, saved) {
  const output = { ...prefill };

  for (const [key, value] of Object.entries(saved || {})) {
    if (String(value ?? '').trim() !== '') {
      output[key] = value;
    }
  }

  return output;
}

export default function CaseWorkspace({ aepCase, client }) {
  const radiusPrefill = {
    nombreApellido: client.fullName || '',
    dob: client.dob || '',
    direccionZc: [client.address, client.city, client.state, client.zip]
      .filter(Boolean)
      .join(', '),
    telefono: client.phone || client.cell || '',
    email: client.email || '',
  };

  const initialTwentyOne = mergePrefill(radiusPrefill, aepCase.twentyOnePoints);
  const initialThirteen = aepCase.thirteenPoints || {};
  const initialPlanQuery =
    aepCase.targetPlanId ||
    aepCase.currentPlanId ||
    aepCase.targetPlanName ||
    aepCase.currentPlanName ||
    '';

  return (
    <section className="min-w-0 rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <Tabs defaultValue="points21">
        <TabsList className="grid grid-cols-2 gap-1 sm:grid-cols-5">
          <TabsTrigger value="points21">
            <ClipboardList className="h-3.5 w-3.5" />
            21 Puntos
          </TabsTrigger>
          <TabsTrigger value="points13">
            <FileText className="h-3.5 w-3.5" />
            13 Puntos
          </TabsTrigger>
          <TabsTrigger value="validator">
            <ShieldAlert className="h-3.5 w-3.5" />
            Validador
          </TabsTrigger>
          <TabsTrigger value="policies">
            <ScrollText className="h-3.5 w-3.5" />
            Pólizas Radius
          </TabsTrigger>
          <TabsTrigger value="close">
            <FolderCheck className="h-3.5 w-3.5" />
            Cierre
          </TabsTrigger>
        </TabsList>

        <TabsContent
          value="points21"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <TwentyOnePoints caseId={aepCase.id} initialValues={initialTwentyOne} />
        </TabsContent>

        <TabsContent
          value="points13"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <ThirteenPoints
            caseId={aepCase.id}
            aepCase={aepCase}
            client={client}
            initialOverrides={initialThirteen}
          />
        </TabsContent>

        <TabsContent
          value="validator"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <PlanValidator
            initialQuery={initialPlanQuery}
            clientState={client.state}
            targetPlanName={aepCase.targetPlanName}
          />
        </TabsContent>

        <TabsContent
          value="policies"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <PoliciesTab
            policies={client.rawPoliciesJson}
            radiusUrl={client.radiusUrl}
            currentCarrier={aepCase.currentCarrier}
            currentPlanName={aepCase.currentPlanName}
          />
        </TabsContent>

        <TabsContent
          value="close"
          forceMount
          className="data-[state=inactive]:hidden"
        >
          <CloseCase
            key={`close-${aepCase.targetPlanName || 'sin-plan'}`}
            caseId={aepCase.id}
            aepCase={aepCase}
            client={client}
          />
        </TabsContent>
      </Tabs>
    </section>
  );
}
