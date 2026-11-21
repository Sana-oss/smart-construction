import { redirect } from 'next/navigation';
import { BUDGET_PATH, ContractList, contractsTextAr, getContractsView } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${contractsTextAr.list.pageTitle} · ركيزة` };

// Contracts and payments (design S17.1). Thin route: the screen lives in the finance module.
export default async function ContractsPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const view = await getContractsView(project.id);
  const { done } = await searchParams;
  return <>
    <ContractList view={view} projectName={project.name} backHref={BUDGET_PATH} notice={done === 'added' || done === 'deleted' ? done : null} />
    <BottomNav active="home" />
  </>;
}
