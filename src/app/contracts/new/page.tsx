import { redirect } from 'next/navigation';
import { getProjectDocuments } from '@/modules/documents';
import { CONTRACTS_PATH, ContractForm, contractsTextAr } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';
import { addContractAction } from '../actions';

export const metadata = { title: `${contractsTextAr.form.pageTitle} · ركيزة` };

// Add a contract (FR-FIN-08). The contract copy is chosen from the project's documents of type «عقد» (composed here:
// finance does not know the documents module).
export default async function NewContractPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const copies = (await getProjectDocuments(project.id)).filter((d) => d.kind === 'contract').map((d) => ({ id: d.id, title: d.title }));
  return <>
    <ContractForm action={addContractAction} copies={copies} backHref={CONTRACTS_PATH} />
    <BottomNav active="home" />
  </>;
}
