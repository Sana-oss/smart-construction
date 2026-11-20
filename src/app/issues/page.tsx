import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, phasePath, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { getIssueListView, issueTextAr, IssuesList } from '@/modules/quality';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${issueTextAr.list.pageTitle} · ركيزة` };

// The defects list (design S28.1), of the project or of one phase (?phase=).
export default async function IssuesPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase: phaseId } = await searchParams;
  const phase = project.phases.find((p) => p.id === phaseId) ?? null;
  const list = await getIssueListView(project.id, phase?.id ?? null);
  return (
    <>
      <IssuesList list={list} phase={phase ? { id: phase.id, name: phase.name } : null} backHref={phase ? phasePath(phase.id) : PROJECT_HOME_PATH} />
      <BottomNav active={phase ? 'phases' : 'home'} />
    </>
  );
}
