import { redirect } from 'next/navigation';
import { ProjectSummary } from '@/modules/dashboard';
import { getSignedInUserId, SignOutButton, WelcomeScreen } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';

// Home:
// - not signed in: the welcome screen (design S01.1);
// - signed in without a project: the first-project wizard (FR-PRJ-01);
// - signed in with a project: the project summary (first slice of the dashboard, FR-DSH-01).
export default async function Home() {
  if (!(await getSignedInUserId())) return <WelcomeScreen />;
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  return <ProjectSummary project={project} actions={<SignOutButton />} />;
}
