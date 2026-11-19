import { redirect } from 'next/navigation';
import {
  expenseTextAr,
  EXPENSES_PATH,
  ExpenseFilterForm,
  filterQuery,
  parseExpenseFilter,
  type ExpenseFilterParams,
} from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${expenseTextAr.filter.pageTitle} · ركيزة` };

// Filter the expenses list (design S13.2). Thin route: the form lives in the finance module; the phase names come
// from the projects module. The form opens with the filter in use (the list links here with its address's query).
export default async function ExpenseFilterPage({ searchParams }: { searchParams: Promise<ExpenseFilterParams> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const filter = parseExpenseFilter(await searchParams);
  const query = filterQuery(filter);
  return (
    <>
      <ExpenseFilterForm
        filter={filter}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        backHref={query ? `${EXPENSES_PATH}?${query}` : EXPENSES_PATH}
      />
      <BottomNav active="expenses" />
    </>
  );
}
