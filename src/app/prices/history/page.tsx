import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getProjectPriceHistory, PriceHistory, priceTextAr, PRICES_PATH } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${priceTextAr.history.pageTitle} · ركيزة` };

type Params = { m?: string | string[]; u?: string | string[]; done?: string };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// One material's price history (design S24.2). The material and unit come from the address; only prices of the
// owner's own project are read (RLS), so a hand-made address can only show "no prices".
export default async function PriceHistoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const params = await searchParams;
  const material = first(params.m).trim();
  const unit = first(params.u).trim();
  if (!material || !unit) redirect(PRICES_PATH);

  const prices = await getProjectPriceHistory(project.id, material, unit, todayInTripoli());
  const notice = params.done === 'added' || params.done === 'deleted' ? params.done : null;
  return (
    <>
      <PriceHistory material={prices[0]?.material ?? material} unit={prices[0]?.unit ?? unit} prices={prices} backHref={PRICES_PATH} notice={notice} />
      <BottomNav active="more" />
    </>
  );
}
