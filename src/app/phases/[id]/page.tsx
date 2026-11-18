import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PhaseScheduleForm, PHASES_PATH, phasesTextAr, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${phasesTextAr.form.subtitle} · ركيزة` };

// One phase's status and dates (FR-PRJ-03). Only phases of the owner's own project are found (RLS); any other id
// gives "page not found", whether it exists or not.
export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const { id } = await params;
  const phase = project.phases.find((p) => p.id === id);
  if (!phase) notFound();

  return (
    <PhaseScheduleForm
      phaseId={phase.id}
      phaseName={phase.name}
      schedule={{
        status: phase.status,
        plannedStart: phase.plannedStart,
        plannedEnd: phase.plannedEnd,
        actualStart: phase.actualStart,
        actualEnd: phase.actualEnd,
      }}
      today={todayInTripoli()}
      backHref={PHASES_PATH}
    />
  );
}
