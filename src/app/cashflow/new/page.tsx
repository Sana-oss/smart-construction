import { redirect } from 'next/navigation';
import { CASHFLOW_PATH, cashflowTextAr, MovementForm } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${cashflowTextAr.form.pageTitle} · ركيزة` };

// Add an obligation or an expected income (design S16.2).
export default async function NewMovementPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  if (!(await getMyProject())) redirect(SETUP_DETAILS_PATH);
  return (
    <>
      <MovementForm backHref={CASHFLOW_PATH} />
      <BottomNav active="more" />
    </>
  );
}
