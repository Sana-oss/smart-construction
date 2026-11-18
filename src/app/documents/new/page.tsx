import { redirect } from 'next/navigation';
import { DocumentForm, documentsTextAr } from '@/modules/documents';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${documentsTextAr.form.pageTitle} · ركيزة` };

// Add a document (FR-DOC-01, design S30.2). With ?phase=<id>, that phase is preselected.
export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase } = await searchParams;
  const phaseId = project.phases.some((p) => p.id === phase) ? phase! : null;
  return <DocumentForm phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} phaseId={phaseId} />;
}
