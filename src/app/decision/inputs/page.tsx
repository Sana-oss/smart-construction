import { redirect } from 'next/navigation';
import { ComparisonForm, DECISION_PATH, decisionTextAr, getStoredComparison } from '@/modules/decisions';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${decisionTextAr.form.pageTitle} · ركيزة` };

// The owner's figures for the three scenarios.
export default async function DecisionInputsPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const stored = await getStoredComparison(project.id);
  return (
    <>
      <ComparisonForm stored={stored?.inputs ?? null} phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} backHref={DECISION_PATH} />
      <BottomNav active="more" />
    </>
  );
}
