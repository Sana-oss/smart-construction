import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { CashflowList, cashflowTextAr, getCashflowView } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from '../_shell/BottomNav';

export const metadata = { title: `${cashflowTextAr.pageTitle} · ركيزة` };

// Obligations and expected income (design S16.1). Thin route: the screen lives in the finance module; «المتاح» and its
// date come from the projects module (the wizard), passed in here.
export default async function CashflowPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const view = await getCashflowView(project, todayInTripoli());
  const { done } = await searchParams;
  return (
    <>
      <CashflowList view={view} backHref={MORE_PATH} notice={done === 'added' || done === 'deleted' ? done : null} />
      <BottomNav active="more" />
    </>
  );
}
