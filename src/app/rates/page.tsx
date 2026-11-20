import { redirect } from 'next/navigation';
import { currencyTextAr, getRateLogView, RateLog } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from '../_shell/BottomNav';

export const metadata = { title: `${currencyTextAr.log.pageTitle} · ركيزة` };

// The owner's reference exchange rates (3.18). Thin route: the screen lives in the finance module.
export default async function RatesPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const log = await getRateLogView(project.id);
  const { done } = await searchParams;
  return (
    <>
      <RateLog log={log} backHref={MORE_PATH} notice={done === 'added' || done === 'deleted' ? done : null} />
      <BottomNav active="more" />
    </>
  );
}
