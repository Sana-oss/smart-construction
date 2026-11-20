import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { getReadinessView, readinessTextAr, ReadinessScreen } from '@/modules/quality';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${readinessTextAr.pageTitle} · ركيزة` };

// The project's readiness list (3.15; FR-PRJ-05). Thin route: the screen lives in the quality module.
export default async function ReadinessPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const view = await getReadinessView(project.id);
  const { done } = await searchParams;
  return (
    <>
      <ReadinessScreen view={view} addFloor={project.projectType === 'add_floor'} backHref={PROJECT_HOME_PATH} notice={done === 'saved' ? 'saved' : null} />
      <BottomNav active="home" />
    </>
  );
}
