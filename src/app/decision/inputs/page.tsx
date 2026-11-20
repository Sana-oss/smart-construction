import { redirect } from 'next/navigation';
import { ComparisonForm, DECISION_PATH, decisionTextAr, getStoredComparison } from '@/modules/decisions';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { currentPhaseOf, getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { getStopPlanView, protectionCostText, stopPlanPath } from '@/modules/quality';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${decisionTextAr.form.pageTitle} · ركيزة` };

// The owner's figures for the three scenarios. The stop plan's protection estimates (3.14) come from quality.
export default async function DecisionInputsPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const stored = await getStoredComparison(project.id);
  // 3.14: pausing now protects the current phase; its stop plan's cost estimates fill «الحماية».
  const current = currentPhaseOf(project.phases);
  const plan = current ? await getStopPlanView(project.id, current.id) : null;
  const total = plan ? protectionCostText(plan.protectionCost) : null;
  return (
    <>
      <ComparisonForm
        stored={stored?.inputs ?? null}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        backHref={DECISION_PATH}
        planProtection={current && total ? { phaseName: current.name, total, href: stopPlanPath(current.id) } : null}
      />
      <BottomNav active="more" />
    </>
  );
}
