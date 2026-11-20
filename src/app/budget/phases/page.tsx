import { redirect } from 'next/navigation';
import { BUDGET_EDIT_PATH, BUDGET_PATH, budgetTextAr, getExtrasView, getProjectBudget, PhaseBudget } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${budgetTextAr.phases.pageTitle} · ركيزة` };

// Budget per phase (design S15.2). Phase names and statuses come from the projects module.
export default async function PhaseBudgetPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const [view, extras] = await Promise.all([getProjectBudget(project), getExtrasView(project)]);
  const { done } = await searchParams;
  return (
    <>
      <PhaseBudget
        view={view}
        extras={extras.use}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name, status: p.status }))}
        spentBeforeLyd={project.spentBeforeLyd}
        backHref={BUDGET_PATH}
        editHref={BUDGET_EDIT_PATH}
        notice={done === 'saved' ? 'saved' : null}
      />
      <BottomNav active="home" />
    </>
  );
}
