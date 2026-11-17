import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { expenseTextAr, ExpenseList, getExpenseList } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${expenseTextAr.list.pageTitle} · ركيزة` };

// Expenses list (design S13.1, empty state S13.3). Thin route: the screen lives in the finance module; the
// phase names come from the projects module, so finance never reads the phases table (module rule 4).
export default async function ExpensesPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const list = await getExpenseList(project.id, todayInTripoli());
  return (
    <ExpenseList
      projectName={project.name}
      list={list}
      phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
      homeHref={PROJECT_HOME_PATH}
    />
  );
}
