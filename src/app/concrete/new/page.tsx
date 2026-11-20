import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { concretePath, concreteTextAr, PourForm } from '@/modules/quality';

export const metadata = { title: `${concreteTextAr.form.pageTitle} · ركيزة` };

// Record a pour (design S27.2). No bottom navigation: a form keeps its save button at the bottom.
export default async function NewPourPage({ searchParams }: { searchParams: Promise<{ phase?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase } = await searchParams;
  const phaseId = project.phases.some((p) => p.id === phase) ? phase! : null;
  return (
    <PourForm phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} phaseId={phaseId} today={todayInTripoli()} backHref={concretePath(phaseId)} />
  );
}
