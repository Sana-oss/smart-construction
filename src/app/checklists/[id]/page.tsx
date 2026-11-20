import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { ChecklistScreen, getChecklistDetailView, phaseChecklistsPath, READINESS_PATH, stopPlanPath } from '@/modules/quality';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: 'قائمة الفحص · ركيزة' };

// One pre-pour checklist (design S26.1). Only the owner's own checklists are found (RLS).
export default async function ChecklistPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getChecklistDetailView(project.id, id);
  if (!detail) notFound();
  // The readiness list has its own page.
  if (detail.checklist.kind === 'readiness') redirect(READINESS_PATH);
  if (detail.checklist.kind === 'safe_stop' && detail.checklist.phaseId) redirect(stopPlanPath(detail.checklist.phaseId));
  const phase = project.phases.find((p) => p.id === detail.checklist.phaseId);
  const { done } = await searchParams;
  return (
    <>
      <ChecklistScreen
        detail={detail}
        phaseName={phase?.name ?? ''}
        backHref={phase ? phaseChecklistsPath(phase.id) : '/phases'}
        notice={done === 'created' || done === 'saved' ? done : null}
      />
      <BottomNav active="phases" />
    </>
  );
}
