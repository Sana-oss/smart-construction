import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getItemDetailView, ItemDetailScreen, type ItemNotice } from '@/modules/materials';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { BottomNav } from '../../../_shell/BottomNav';
import { finishPurchaseExpenseAction } from './purchase/actions';

export const metadata = { title: 'تفاصيل بند · ركيزة' };

const NOTICES = ['added', 'purchased', 'expense_pending', 'expense_finished', 'not_deleted'] as const;

// One line of the quantity table (design S20.2). Thin route: the screen lives in the materials module; finishing a
// purchase's expense is the app's action because it needs finance.
export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ done?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id } = await params;
  const detail = await getItemDetailView(project.id, id);
  if (!detail) notFound();
  const { done } = await searchParams;
  const notice: ItemNotice = (NOTICES as readonly string[]).includes(done ?? '') ? (done as ItemNotice) : null;
  return (
    <>
      <ItemDetailScreen
        detail={detail}
        phaseName={project.phases.find((p) => p.id === detail.item.phaseId)?.name ?? null}
        notice={notice}
        finishExpense={(purchaseId) => finishPurchaseExpenseAction.bind(null, detail.item.id, purchaseId)}
      />
      <BottomNav active="materials" />
    </>
  );
}
