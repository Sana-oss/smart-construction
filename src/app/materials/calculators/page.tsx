import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { calcTextAr, OtherCalculators } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${calcTextAr.others.pageTitle} · ركيزة` };

// Other calculators (design S23.1; FR-MAT-05).
export default async function CalculatorsPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);
  return (
    <>
      <OtherCalculators />
      <BottomNav active="materials" />
    </>
  );
}
