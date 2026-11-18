import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { documentsOfPhasePath, documentsTextAr, filesCountAr, getProjectDocuments } from '@/modules/documents';
import { getMyProject, getProjectTasks, PhaseDetail, PHASES_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

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

  const [allTasks, documents] = await Promise.all([getProjectTasks(project.id), getProjectDocuments(project.id)]);
  const tasks = allTasks.filter((t) => t.phaseId === phase.id);
  // Design S10.4: the phase's documents, from the documents module (projects may not import it).
  const phaseDocs = documents.filter((d) => d.phaseId === phase.id).length;
  const links = [{ label: documentsTextAr.list.phaseTitle, note: filesCountAr(phaseDocs), href: documentsOfPhasePath(phase.id) }];
  return (
    <>
      <PhaseDetail phase={phase} tasks={tasks} today={todayInTripoli()} backHref={PHASES_PATH} links={links} />
      <BottomNav active="phases" />
    </>
  );
}
