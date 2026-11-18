import { redirect } from 'next/navigation';
import { DocumentList, documentsTextAr, getProjectDocuments } from '@/modules/documents';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, phasePath, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from '../_shell/BottomNav';

export const metadata = { title: `${documentsTextAr.list.pageTitle} · ركيزة` };

// Project documents (FR-DOC-01, design S30.1). With ?phase=<id>: that phase's documents (S10.4), opened from the
// phase page. Thin route: the screen lives in the documents module; phases come from the projects module.
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const { phase } = await searchParams;
  const phaseId = project.phases.some((p) => p.id === phase) ? phase! : null; // an unknown phase shows everything
  const documents = await getProjectDocuments(project.id);
  return (
    <>
      <DocumentList documents={documents} phases={project.phases} phaseId={phaseId} backHref={phaseId ? phasePath(phaseId) : MORE_PATH} />
      <BottomNav active={phaseId ? 'phases' : 'more'} />
    </>
  );
}
