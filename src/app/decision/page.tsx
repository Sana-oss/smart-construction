import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { DecisionOverview, decisionTextAr, getComparison } from '@/modules/decisions';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { PRICES_PATH } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav, MORE_PATH } from '../_shell/BottomNav';

export const metadata = { title: `${decisionTextAr.overview.pageTitle} · ركيزة` };

// Continue or pause (design S18.1). Thin route: the screen lives in the decisions module (level 3), which reads the
// cash (finance) and the price log (materials) through their public APIs.
export default async function DecisionPage({ searchParams }: { searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);

  const view = await getComparison(project, todayInTripoli());
  const { done } = await searchParams;
  return (
    <>
      <DecisionOverview
        view={view}
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        backHref={MORE_PATH}
        pricesHref={PRICES_PATH}
        notice={done === 'saved' || done === 'reviewed' ? done : null}
      />
      <BottomNav active="more" />
    </>
  );
}
