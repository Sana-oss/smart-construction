import { redirect } from 'next/navigation';
import { formatAmount } from '@/shared-kernel';
import { AllocationForm, BUDGET_PHASES_PATH, budgetTextAr, getProjectBudget } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../_shell/BottomNav';

export const metadata = { title: `${budgetTextAr.form.pageTitle} · ركيزة` };

// The budget plan's form: one allocation per phase.
export default async function AllocationEditPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { plan } = await getProjectBudget(project);
  const phases = project.phases.map((p) => {
    const row = plan.rows.find((r) => r.phaseId === p.id);
    return { id: p.id, name: p.name, allocated: row?.allocated ? row.allocated.toFixed(3) : null };
  });
  return (
    <>
      <AllocationForm phases={phases} forPhases={formatAmount(plan.forPhases)} backHref={BUDGET_PHASES_PATH} />
      <BottomNav active="home" />
    </>
  );
}
