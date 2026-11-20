import { redirect } from 'next/navigation';
import { DECISION_PATH, decisionTextAr, getStoredComparison, ReviewForm } from '@/modules/decisions';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../_shell/BottomNav';

export const metadata = { title: `${decisionTextAr.review.pageTitle} · ركيزة` };

// Review the scenario (design S18.2), an owner-only checklist.
export default async function DecisionReviewPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const stored = await getStoredComparison(project.id);
  const phaseName = project.phases.find((p) => p.id === stored?.inputs.phaseId)?.name ?? null;
  return (
    <>
      <ReviewForm review={stored?.review ?? null} phaseName={phaseName} backHref={DECISION_PATH} />
      <BottomNav active="more" />
    </>
  );
}
