import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { contractPath, getContractDetail, PaymentDetail, settleTextAr } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../../_shell/BottomNav';
import { dueByPayment } from '../../../due';
import { payAction, releaseAction, undoPaymentAction, undoReleaseAction } from './actions';

export const metadata = { title: `${settleTextAr.pageTitle} · ركيزة` };

// One installment (design S17.3). Composed here: the due state needs the phase and its photos (other modules).
export default async function PaymentPage({ params, searchParams }: { params: Promise<{ id: string; paymentId: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id, paymentId } = await params;
  const detail = await getContractDetail(project.id, id);
  const payment = detail?.payments.find((p) => p.id === paymentId.toLowerCase());
  if (!detail || !payment) notFound();
  const due = (await dueByPayment(project, [payment]))[payment.id];
  const { done } = await searchParams;
  const notice = done === 'paid' || done === 'paid-no-expense' || done === 'released' || done === 'undone-paid' || done === 'undone-release' ? done : null;
  return (
    <>
      <PaymentDetail
        contract={detail.contract}
        payment={payment}
        due={due}
        phaseName={project.phases.find((p) => p.id === payment.phaseId)?.name ?? null}
        allPhasesDone={project.phases.every((p) => p.status === 'done')}
        today={todayInTripoli()}
        payAction={payAction.bind(null, detail.contract.id, payment.id)}
        releaseAction={releaseAction.bind(null, detail.contract.id, payment.id)}
        undoPaymentAction={undoPaymentAction.bind(null, detail.contract.id, payment.id)}
        undoReleaseAction={undoReleaseAction.bind(null, detail.contract.id, payment.id)}
        backHref={contractPath(detail.contract.id)}
        notice={notice}
      />
      <BottomNav active="home" />
    </>
  );
}
