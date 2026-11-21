import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { EXPENSES_PATH, ExpenseReport, getExpenseReportView, parseExpenseFilter, reportTextAr, type ExpenseFilterParams } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${reportTextAr.pageTitle} · ركيزة` };

// The expenses report (FR-FIN-05), for the period in its address (?period=). Thin route: the screen lives in the finance
// module; the phases (names, plan order) come from the projects module, so finance never reads the phases table (rule 4).
export default async function ExpenseReportPage({ searchParams }: { searchParams: Promise<ExpenseFilterParams> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  // The finance domain checks the period; anything unknown becomes «كل الفترات».
  const { period } = parseExpenseFilter(await searchParams);
  const view = await getExpenseReportView({ id: project.id, phases: project.phases }, period, todayInTripoli());
  return (
    <>
      <ExpenseReport
        view={view}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        spentBeforeLyd={project.spentBeforeLyd}
        backHref={EXPENSES_PATH}
      />
      <BottomNav active="expenses" />
    </>
  );
}
