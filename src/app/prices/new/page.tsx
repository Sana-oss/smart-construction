import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getProjectPriceLog, PriceForm, priceHistoryPath, priceTextAr, PRICES_PATH } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${priceTextAr.form.pageTitle} · ركيزة` };

type Params = { m?: string | string[]; u?: string | string[] };
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

// Add a price or a quote (design S24.3). ?m=&u= start the form on one material («إضافة تحديث للسعر» in S24.2).
export default async function NewPricePage({ searchParams }: { searchParams: Promise<Params> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const today = todayInTripoli();
  const log = await getProjectPriceLog(project.id, today);
  const params = await searchParams;
  const material = first(params.m).trim();
  const unit = first(params.u).trim();
  const start = material && unit ? { material, unit } : undefined;
  return (
    <>
      <PriceForm
        backHref={start ? priceHistoryPath(start.material, start.unit) : PRICES_PATH}
        today={today}
        start={start}
        knownMaterials={log.knownMaterials}
        knownUnits={log.knownUnits}
      />
      <BottomNav active="more" />
    </>
  );
}
