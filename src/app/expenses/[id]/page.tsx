import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { EditExpenseForm, expenseTextAr, EXPENSES_PATH, getExpense, getLatestRates } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${expenseTextAr.edit.pageTitle} · ركيزة` };

// One expense: edit or delete it (decision of 19 Nov 2026). Only expenses of the owner's own project are found
// (RLS); any other id gives "page not found", whether it exists or not.
export default async function ExpensePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const { id } = await params;
  const [expense, rates] = await Promise.all([getExpense(project.id, id), getLatestRates(project.id)]);
  if (!expense) notFound();

  return (
    <>
      <EditExpenseForm
        expense={expense}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        today={todayInTripoli()}
        backHref={EXPENSES_PATH}
        rates={rates}
      />
      <BottomNav active="expenses" />
    </>
  );
}
