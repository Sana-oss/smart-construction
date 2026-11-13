import { getPhaseTemplate, PhasesStep } from '@/modules/projects';

export const metadata = { title: 'خطة المراحل · ركيزة' };

// Wizard step 2 (design S02.2). The phase list comes from the phase_templates table (reference data, 0006).
export default async function PhasesPage() {
  return <PhasesStep template={await getPhaseTemplate()} />;
}
