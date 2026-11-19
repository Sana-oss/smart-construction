import { redirect } from 'next/navigation';
import { ProjectSummary } from '@/modules/dashboard';
import { todayInTripoli } from '@/shared-kernel';
import { getMyFirstName, getSignedInUserId, WelcomeScreen } from '@/modules/identity';
import { getMyProject, getProjectTasks, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from './_shell/BottomNav';

// Home:
// - not signed in: the welcome screen (design S01.1);
// - signed in without a project: the first-project wizard (FR-PRJ-01);
// - signed in with a project: the project dashboard (FR-DSH-01, FR-DSH-02, design S07.1).
export default async function Home() {
  if (!(await getSignedInUserId())) return <WelcomeScreen />;
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  return (
    <>
      <ProjectSummary
        project={project}
        tasks={await getProjectTasks(project.id)}
        today={todayInTripoli()}
        firstName={await getMyFirstName()}
        moreHref={MORE_PATH}
      />
      <BottomNav active="home" />
    </>
  );
}
