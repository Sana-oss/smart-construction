import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, getProjectTasks, PhasesList, phasesTextAr, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${phasesTextAr.pageTitle} · ركيزة` };

// Phases screen (FR-PRJ-03, design S09.1). Thin route: the screen lives in the projects module.
export default async function PhasesPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const tasks = await getProjectTasks(project.id);
  return (
    <>
      <PhasesList projectName={project.name} phases={project.phases} tasks={tasks} today={todayInTripoli()} homeHref={PROJECT_HOME_PATH} />
      <BottomNav active="phases" />
    </>
  );
}
