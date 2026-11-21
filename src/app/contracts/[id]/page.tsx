import { notFound, redirect } from 'next/navigation';
import { getProjectDocuments } from '@/modules/documents';
import { CONTRACTS_PATH, ContractDetail, contractsTextAr, getContractDetail } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';
import { dueByPayment } from '../due';

export const metadata = { title: `${contractsTextAr.detail.pageTitle} · ركيزة` };

// One contract and its payment schedule (design S17.2). The contract copy is a document: composed here, because finance
// does not know the documents module.
export default async function ContractPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getContractDetail(project.id, id);
  if (!detail) notFound();
  const documentId = detail.contract.documentId;
  const doc = documentId ? (await getProjectDocuments(project.id)).find((d) => d.id === documentId && d.kind === 'contract') : undefined;
  const due = await dueByPayment(project, detail.payments);
  const { done } = await searchParams;
  const notice = done === 'added' || done === 'payment-added' || done === 'payment-deleted' ? done : null;
  return <>
    <ContractDetail
      detail={detail}
      phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
      dueByPayment={due}
      copy={doc ? { title: doc.title, url: doc.url } : null}
      backHref={CONTRACTS_PATH}
      notice={notice}
    />
    <BottomNav active="home" />
  </>;
}
