import { redirect } from 'next/navigation';
import { BUDGET_PATH, ExtrasList, extrasTextAr, getExtrasView } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${extrasTextAr.list.pageTitle} · ركيزة` };

// Extra works and changes (FR-FIN-10). Thin route: the screen lives in the finance module; phase names come from projects.
export default async function ExtrasPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const view = await getExtrasView(project);
  const { done } = await searchParams;
  const notice = done === 'added' || done === 'changed' || done === 'deleted' ? done : null;
  return (
    <>
      <ExtrasList view={view} phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} backHref={BUDGET_PATH} notice={notice} />
      <BottomNav active="home" />
    </>
  );
}
