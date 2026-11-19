import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { expenseTextAr, ExpenseList, getExpenseList, parseExpenseFilter, type ExpenseFilterParams } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${expenseTextAr.list.pageTitle} · ركيزة` };

// Expenses list (design S13.1, empty state S13.3), filtered by its address (S13.2: ?q=&period=&phase=&type=). Thin route: the screen lives in the finance module; the
// phase names come from the projects module, so finance never reads the phases table (module rule 4).
export default async function ExpensesPage({ searchParams }: { searchParams: Promise<ExpenseFilterParams> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const params = await searchParams;
  // Every value of the address is checked by the finance domain; anything unknown is ignored.
  const list = await getExpenseList(project.id, todayInTripoli(), parseExpenseFilter(params));
  // After an edit or a deletion (finance actions redirect here with ?done=...): a short confirmation.
  const done = params.done;
  const notice = done === 'updated' || done === 'deleted' ? done : null;
  return (
    <>
      <ExpenseList
        projectName={project.name}
        list={list}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        homeHref={PROJECT_HOME_PATH}
        notice={notice}
      />
      <BottomNav active="expenses" />
    </>
  );
}
