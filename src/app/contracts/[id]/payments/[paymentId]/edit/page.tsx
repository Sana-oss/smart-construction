import { notFound, redirect } from 'next/navigation';
import { money } from '@/shared-kernel';
import { contractPath, contractsTextAr, getContractDetail, PaymentForm, paymentPath, updatePaymentAction } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../../../_shell/BottomNav';

export const metadata = { title: `${contractsTextAr.editPaymentForm.pageTitle} · ركيزة` };

// Edit an UNPAID installment (3.16 deepening, owner's decision of 21 Nov 2026). A paid one goes back to its page: what was
// paid is a fact (the database also refuses changing its amount, 0032); undo the payment first.
export default async function EditPaymentPage({ params }: { params: Promise<{ id: string; paymentId: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id, paymentId } = await params;
  const detail = await getContractDetail(project.id, id);
  const payment = detail?.payments.find((p) => p.id === paymentId.toLowerCase());
  if (!detail || !payment) notFound();
  if (payment.paidOn !== null) redirect(paymentPath(detail.contract.id, payment.id));
  return (
    <>
      <PaymentForm
        mode="edit"
        action={updatePaymentAction.bind(null, detail.contract.id, payment.id)}
        contractTitle={detail.contract.title}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        backHref={contractPath(detail.contract.id)}
        initial={{
          title: payment.title,
          amount: payment.amountLyd,
          retained: money(payment.retainedLyd).gt(0) ? payment.retainedLyd : '',
          phaseId: payment.phaseId ?? '',
        }}
      />
      <BottomNav active="home" />
    </>
  );
}
