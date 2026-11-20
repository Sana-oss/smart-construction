import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { checklistTextAr, getPhaseChecklistsView, PhaseChecklists } from '@/modules/quality';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${checklistTextAr.phase.pageTitle} · ركيزة` };

// The pre-pour checklists of one phase (3.12). The phase comes in the address and must be one of the owner's.
export default async function PhaseChecklistsPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase: phaseId } = await searchParams;
  const phase = project.phases.find((p) => p.id === phaseId);
  if (!phase) notFound();
  const checklists = await getPhaseChecklistsView(project.id, phase.id);
  return (
    <>
      <PhaseChecklists phase={{ id: phase.id, name: phase.name }} checklists={checklists} backHref={`/phases/${phase.id}`} />
      <BottomNav active="phases" />
    </>
  );
}
