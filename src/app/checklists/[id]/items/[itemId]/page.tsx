import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { checklistPath, checklistTextAr, CheckItemForm, getChecklistDetailView, recordCheckAction } from '@/modules/quality';

export const metadata = { title: `${checklistTextAr.item.pageTitle} · ركيزة` };

// Recording the check of one item (design S26.2). No bottom navigation: a form keeps its save button at the bottom.
export default async function CheckItemPage({ params }: { params: Promise<{ id: string; itemId: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { id, itemId } = await params;
  const detail = await getChecklistDetailView(project.id, id);
  const item = detail?.items.find((i) => i.id === itemId);
  if (!detail || !item) notFound();
  return (
    <CheckItemForm
      action={recordCheckAction.bind(null, detail.checklist.id, item.id)}
      item={item}
      checklistTitle={detail.checklist.title}
      backHref={checklistPath(detail.checklist.id)}
    />
  );
}
