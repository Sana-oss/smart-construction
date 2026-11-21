import { notFound, redirect } from 'next/navigation';
import { contractPath, contractsTextAr, getContractDetail, PaymentForm } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../../_shell/BottomNav';

export const metadata = { title: `${contractsTextAr.paymentForm.pageTitle} · ركيزة` };

// Add a payment to a contract's schedule (FR-FIN-09).
export default async function NewPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getContractDetail(project.id, id);
  if (!detail) notFound();
  return <>
    <PaymentForm
      contractId={detail.contract.id}
      contractTitle={detail.contract.title}
      phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
      backHref={contractPath(detail.contract.id)}
    />
    <BottomNav active="home" />
  </>;
}
