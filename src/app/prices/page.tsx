import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getProjectPriceLog, PriceLog, priceTextAr } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from '../_shell/BottomNav';

export const metadata = { title: `${priceTextAr.log.pageTitle} · ركيزة` };

// Price log (design S24.1). Thin route: the screen lives in the materials module.
export default async function PricesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const log = await getProjectPriceLog(project.id, todayInTripoli());
  const { done } = await searchParams;
  return (
    <>
      <PriceLog log={log} backHref={MORE_PATH} notice={done === 'deleted' ? 'deleted' : null} />
      <BottomNav active="more" />
    </>
  );
}
