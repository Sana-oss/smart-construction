import { notFound, redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import {
  checklistPath,
  checklistTextAr,
  CheckItemForm,
  getChecklistDetailView,
  getCheckPhotoUrl,
  READINESS_PATH,
  newIssuePath,
  recordCheckAction,
  stopPlanPath,
} from '@/modules/quality';

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
      photoUrl={await getCheckPhotoUrl(item.photoPath)}
      checklistTitle={detail.checklist.title}
      kind={detail.checklist.kind}
      newIssueHref={detail.checklist.kind === 'hold_point' ? newIssuePath({ checklistId: detail.checklist.id, itemId: item.id }) : null}
      backHref={
        detail.checklist.kind === 'readiness'
          ? READINESS_PATH
          : detail.checklist.kind === 'safe_stop' && detail.checklist.phaseId
            ? stopPlanPath(detail.checklist.phaseId)
            : checklistPath(detail.checklist.id)
      }
    />
  );
}
