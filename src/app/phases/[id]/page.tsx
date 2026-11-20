import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { documentsOfPhasePath, documentsTextAr, filesCountAr, getProjectDocuments } from '@/modules/documents';
import { getMyProject, getProjectTasks, PhaseDetail, PHASES_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { checklistTextAr, getChecklistCountsView, getStopPlanProgress, phaseChecklistsPath, stopPlanPath, stopPlanTextAr } from '@/modules/quality';
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

  const [allTasks, documents, checklists, stopPlans] = await Promise.all([
    getProjectTasks(project.id),
    getProjectDocuments(project.id),
    getChecklistCountsView(project.id),
    getStopPlanProgress(project.id),
  ]);
  const tasks = allTasks.filter((t) => t.phaseId === phase.id);
  // Design S10.4: the phase's documents, from the documents module (projects may not import it).
  const phaseDocs = documents.filter((d) => d.phaseId === phase.id).length;
  // Design S10.1 «قائمة الفحص»: the phase's pre-pour checklists, from the quality module (3.12).
  const lists = checklists[phase.id];
  const links = [
    {
      label: checklistTextAr.phaseLink.title,
      note: lists ? checklistTextAr.phaseLink.count(lists.count, lists.open) : checklistTextAr.phaseLink.none,
      href: phaseChecklistsPath(phase.id),
    },
    // Design S10.1 «نقاط التوقف الآمنة» (3.14): the phase's stop plan.
    {
      label: stopPlanTextAr.phaseLink.title,
      note: stopPlans[phase.id] ? stopPlanTextAr.phaseLink.plan(stopPlans[phase.id].checked, stopPlans[phase.id].total) : stopPlanTextAr.phaseLink.none,
      href: stopPlanPath(phase.id),
    },
    { label: documentsTextAr.list.phaseTitle, note: filesCountAr(phaseDocs), href: documentsOfPhasePath(phase.id) },
  ];
  return (
    <>
      <PhaseDetail phase={phase} tasks={tasks} today={todayInTripoli()} backHref={PHASES_PATH} links={links} />
      <BottomNav active="phases" />
    </>
  );
}
