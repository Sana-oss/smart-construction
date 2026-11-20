import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { calcTextAr, MaterialsHome } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${calcTextAr.home.pageTitle} · ركيزة` };

// «المواد» tab (design S20.1). Thin route: the screen lives in the materials module.
export default async function MaterialsPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);
  return (
    <>
      <MaterialsHome />
      <BottomNav active="materials" />
    </>
  );
}
