import { notFound, redirect } from 'next/navigation';
import { todayInTripoli } from '@/shared-kernel';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getItemDetailView, itemPath, PurchaseForm, qtyTextAr } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { recordPurchaseAction } from './actions';

export const metadata = { title: `${qtyTextAr.purchaseForm.pageTitle} · ركيزة` };

// Record a purchase for one line (design S21.1). No bottom navigation: a form keeps its save button at the bottom.
export default async function PurchasePage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getItemDetailView(project.id, id);
  if (!detail) notFound();
  const { item } = detail;
  return (
    <PurchaseForm
      action={recordPurchaseAction.bind(null, item.id, item.unit)}
      material={item.material}
      unit={item.unit}
      phaseName={project.phases.find((p) => p.id === item.phaseId)?.name ?? null}
      today={todayInTripoli()}
      backHref={itemPath(item.id)}
    />
  );
}
