import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { expenseTextAr as t, QuickExpenseForm } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, PROJECT_HOME_PATH, SETUP_DETAILS_PATH } from '@/modules/projects';

export const metadata = { title: `${t.pageTitle} · ركيزة` };

// Quick expense (FR-FIN-02, design S14.1). Thin route: the screen lives in the finance module.
// Only for a signed-in owner with a project; anyone else is sent to sign-in or to the wizard.
export default async function NewExpensePage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  return (
    <QuickExpenseForm
      phases={project.phases.map((p) => ({ id: p.id, name: p.name, current: p.status === 'in_progress' }))}
      today={todayInTripoli()}
      homeHref={PROJECT_HOME_PATH}
    />
  );
}
