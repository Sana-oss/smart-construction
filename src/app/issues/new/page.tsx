import { redirect } from 'next/navigation';
import { getSignedInUserId, SIGN_IN_PATH } from '@/modules/identity';
import { getMyProject, SETUP_DETAILS_PATH } from '@/modules/projects';
import { checkItemPath, getChecklistDetailView, IssueForm, issuesPath, issueTextAr } from '@/modules/quality';

export const metadata = { title: `${issueTextAr.form.pageTitle} · ركيزة` };

// Record a defect (design S28.2). From a phase (?phase=), or from a checklist item with a problem (?checklist=&item=,
// S26.2 «تسجيل عيب مرتبط»), which fills the form with the phase, the item's text, its note and who fixes it.
export default async function NewIssuePage({ searchParams }: { searchParams: Promise<{ phase?: string; checklist?: string; item?: string }> }) {
  if (!(await getSignedInUserId())) redirect(SIGN_IN_PATH);
  const project = await getMyProject();
  if (!project) redirect(SETUP_DETAILS_PATH);
  const { phase, checklist, item } = await searchParams;

  let start: { phaseId?: string; title?: string; description?: string; responsible?: string; checklistId?: string } = {
    phaseId: project.phases.some((p) => p.id === phase) ? phase : undefined,
  };
  let fromItem: string | null = null;
  let backHref = issuesPath(start.phaseId);
  if (checklist && item) {
    const detail = await getChecklistDetailView(project.id, checklist);
    const it = detail?.items.find((i) => i.id === item);
    if (detail && it) {
      start = {
        phaseId: detail.checklist.phaseId ?? undefined,
        title: it.text,
        description: it.note ?? undefined,
        responsible: it.responsible ?? undefined,
        checklistId: detail.checklist.id,
      };
      fromItem = it.text;
      backHref = checkItemPath(detail.checklist.id, it.id);
    }
  }
  return <IssueForm phases={project.phases.map((p) => ({ id: p.id, name: p.name }))} start={start} fromItem={fromItem} backHref={backHref} />;
}
