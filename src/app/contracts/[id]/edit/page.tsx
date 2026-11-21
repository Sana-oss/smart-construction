import { notFound, redirect } from 'next/navigation';
import { getProjectDocuments } from '@/modules/documents';
import { ContractForm, contractPath, contractsTextAr, getContractDetail } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../_shell/BottomNav';
import { updateContractAction } from '../../actions';

export const metadata = { title: `${contractsTextAr.editForm.pageTitle} · ركيزة` };

// Edit a contract (3.16 deepening). The contract copy is chosen from the project's documents of type «عقد» (composed here:
// finance does not know the documents module). Every change is audited with its old values (0031).
export default async function EditContractPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getContractDetail(project.id, id);
  if (!detail) notFound();
  const c = detail.contract;
  const copies = (await getProjectDocuments(project.id)).filter((d) => d.kind === 'contract').map((d) => ({ id: d.id, title: d.title }));
  return (
    <>
      <ContractForm
        mode="edit"
        action={updateContractAction.bind(null, c.id)}
        copies={copies}
        backHref={contractPath(c.id)}
        initial={{ title: c.title, contractor: c.contractor, value: c.valueLyd, scope: c.scope ?? '', cleanupClause: c.cleanupClause ?? '', documentId: c.documentId ?? '' }}
      />
      <BottomNav active="home" />
    </>
  );
}
