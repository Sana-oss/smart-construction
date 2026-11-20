import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { getIssueView, IssueDetailScreen, issuesPath, issueTextAr } from '@/modules/quality';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${issueTextAr.detail.pageTitle} · ركيزة` };

// Following one defect (design S28.3). Only the owner's own defects are found (RLS).
export default async function IssuePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const view = await getIssueView(project.id, id);
  if (!view) notFound();
  const phase = project.phases.find((p) => p.id === view.issue.phaseId) ?? null;
  const { done } = await searchParams;
  return (
    <>
      <IssueDetailScreen
        issue={view.issue}
        photoUrl={view.photoUrl}
        phaseName={phase?.name ?? null}
        backHref={issuesPath(phase?.id)}
        notice={done === 'added' || done === 'changed' ? done : null}
      />
      <BottomNav active={phase ? 'phases' : 'home'} />
    </>
  );
}
