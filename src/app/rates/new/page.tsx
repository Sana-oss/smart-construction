import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { currencyTextAr, RateForm, RATES_PATH } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${currencyTextAr.form.pageTitle} · ركيزة` };

// Add a reference exchange rate (3.18).
export default async function NewRatePage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);
  return (
    <>
      <RateForm backHref={RATES_PATH} today={todayInTripoli()} />
      <BottomNav active="more" />
    </>
  );
}
