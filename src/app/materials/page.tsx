import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { calcTextAr, getQuantityTableView, MaterialsHome } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${calcTextAr.home.pageTitle} · ركيزة` };

// «المواد» tab (design S20.1). Thin route: the screen lives in the materials module.
export default async function MaterialsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const table = await getQuantityTableView(project.id);
  const { done } = await searchParams;
  return (
    <>
      <MaterialsHome table={table} notice={done === 'deleted' ? 'deleted' : null} />
      <BottomNav active="materials" />
    </>
  );
}
