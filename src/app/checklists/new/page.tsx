import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { checklistTextAr, createChecklistAction, getChecklistTemplates, NewChecklistForm, phaseChecklistsPath } from '@/modules/quality';

export const metadata = { title: `${checklistTextAr.form.pageTitle} · ركيزة` };

// A new pre-pour checklist for one phase (FR-QLT-02). No bottom navigation: a form keeps its save button at the bottom.
export default async function NewChecklistPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase: phaseId } = await searchParams;
  const phase = project.phases.find((p) => p.id === phaseId);
  if (!phase) notFound();
  return (
    <NewChecklistForm
      action={createChecklistAction.bind(null, phase.id)}
      phaseName={phase.name}
      templates={await getChecklistTemplates()}
      backHref={phaseChecklistsPath(phase.id)}
    />
  );
}
