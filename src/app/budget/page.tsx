import { redirect } from 'next/navigation';
import { DECISION_PATH } from '@/modules/decisions';
import { BudgetOverview, budgetTextAr, BUDGET_PHASES_PATH, CASHFLOW_PATH, CONTRACTS_PATH, EXTRAS_PATH, getContractsView, getExtrasView, getProjectBudget } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../_shell/BottomNav';

export const metadata = { title: `${budgetTextAr.overview.pageTitle} · ركيزة` };

// Project budget (design S15.1). The app layer gathers the links of several modules (finance, decisions).
export default async function BudgetPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const [view, extras, contracts] = await Promise.all([getProjectBudget(project), getExtrasView(project), getContractsView(project.id)]);
  return (
    <>
      <BudgetOverview
        view={view}
        extras={extras.use}
        contracts={{ count: contracts.contracts.length, totalValueLyd: contracts.totalValue.toFixed(3) }}
        backHref={PROJECT_HOME_PATH}
        links={{ phases: BUDGET_PHASES_PATH, extras: EXTRAS_PATH, cashflow: CASHFLOW_PATH, contracts: CONTRACTS_PATH, decision: DECISION_PATH }}
      />
      <BottomNav active="home" />
    </>
  );
}
