import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { concretePath, concreteTextAr, getPourView, PourDetail } from '@/modules/quality';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${concreteTextAr.detail.pageTitle} · ركيزة` };

// One pour and its reminders (FR-QLT-04, FR-QLT-05). Only the owner's own pours are found (RLS).
export default async function PourPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const pour = await getPourView(project.id, id);
  if (!pour) notFound();
  const phase = project.phases.find((p) => p.id === pour.phaseId) ?? null;
  const { done } = await searchParams;
  return (
    <>
      <PourDetail
        pour={pour}
        phaseName={phase?.name ?? null}
        backHref={concretePath(phase?.id)}
        notice={done === 'added' || done === 'changed' ? done : null}
      />
      <BottomNav active={phase ? 'phases' : 'home'} />
    </>
  );
}
