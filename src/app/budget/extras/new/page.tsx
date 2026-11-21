import { redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { ExtraForm, extrasTextAr, EXTRAS_PATH, getContractsView } from '@/modules/finance';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../_shell/BottomNav';

export const metadata = { title: `${extrasTextAr.form.pageTitle} · ركيزة` };

// Add an extra work or change (FR-FIN-10).
export default async function NewExtraPage() {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const contracts = await getContractsView(project.id);
  return (
    <>
      <ExtraForm
        phases={project.phases.map((p) => ({ id: p.id, name: p.name }))}
        contracts={contracts.contracts.map((c) => ({ id: c.id, title: c.title }))}
        today={todayInTripoli()}
        backHref={EXTRAS_PATH}
      />
      <BottomNav active="home" />
    </>
  );
}
