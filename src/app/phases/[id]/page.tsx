import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, getProjectTasks, PhaseDetail, PHASES_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: 'المرحلة · ركيزة' };

// One phase: its progress and tasks (FR-PRJ-04, design S10.1/S10.2). Only phases of the owner's own project are
// found (RLS); any other id gives "page not found", whether it exists or not.
export default async function PhasePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const { id } = await params;
  const phase = project.phases.find((p) => p.id === id);
  if (!phase) notFound();

  const tasks = (await getProjectTasks(project.id)).filter((t) => t.phaseId === phase.id);
  return <PhaseDetail phase={phase} tasks={tasks} today={todayInTripoli()} backHref={PHASES_PATH} />;
}
