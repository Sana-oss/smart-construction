import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, phasePath, PhaseScheduleForm, phasesTextAr, SETUP_DETAILS_PATH } from '@/modules/projects';
import { issuesPath, READINESS_PATH } from '@/modules/quality';
import { savePhaseWithGateAction } from './actions';

export const metadata = { title: `${phasesTextAr.form.subtitle} · ركيزة` };

// One phase's status and dates (FR-PRJ-03), with the readiness gate on starting it (FR-PRJ-05), opened from the phase page. Only phases of the owner's own project are found (RLS); any other id
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
      backHref={phasePath(phase.id)}
      action={savePhaseWithGateAction.bind(null, phase.id)}
      readinessHref={READINESS_PATH}
      issuesHref={issuesPath(phase.id)}
    />
  );
}
