import { notFound, redirect } from 'next/navigation';
import { DECISION_INPUTS_PATH } from '@/modules/decisions';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, phasePath, SETUP_DETAILS_PATH } from '@/modules/projects';
import { getStopPlanView, stopPlanTextAr, StopPlanScreen } from '@/modules/quality';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${stopPlanTextAr.pageTitle} · ركيزة` };

// A phase's stop plan (3.14; design S19.1). The phase comes in the address and must be one of the owner's.
export default async function StopPlanPage({ searchParams }: { searchParams: Promise<{ phase?: string; done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase: phaseId, done } = await searchParams;
  const phase = project.phases.find((p) => p.id === phaseId);
  if (!phase) notFound();
  const view = await getStopPlanView(project.id, phase.id);
  return (
    <>
      <StopPlanScreen
        phase={{ id: phase.id, name: phase.name }}
        view={view}
        backHref={phasePath(phase.id)}
        scenarioHref={DECISION_INPUTS_PATH}
        notice={done === 'saved' ? 'saved' : null}
      />
      <BottomNav active="phases" />
    </>
  );
}
