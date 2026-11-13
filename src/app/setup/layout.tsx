import type { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH } from '@/modules/projects';

// First-project wizard (FR-PRJ-01). Only for a signed-in owner who has no project yet (one project per owner for
// now, decision 10): anyone else is sent to sign-in or to their project.
export default async function SetupLayout({ children }: { children: ReactNode }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (await getMyProject()) redirect(PROJECT_HOME_PATH);
  return children;
}
