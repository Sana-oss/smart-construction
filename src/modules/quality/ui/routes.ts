// Routes of the quality screens (pre-pour checkpoints, 3.12).

/** The checklists of one phase. */
export const phaseChecklistsPath = (phaseId: string) => `/checklists?phase=${encodeURIComponent(phaseId)}`;
/** A new checklist for one phase. */
export const newChecklistPath = (phaseId: string) => `/checklists/new?phase=${encodeURIComponent(phaseId)}`;
/** One checklist (design S26.1). */
export const checklistPath = (id: string) => `/checklists/${id}`;
/** One item of a checklist (design S26.2). */
export const checkItemPath = (checklistId: string, itemId: string) => `/checklists/${checklistId}/items/${itemId}`;

/** The project's readiness list (3.15). */
export const READINESS_PATH = '/readiness';

/** A phase's stop plan (3.14, design S19.1). */
export const stopPlanPath = (phaseId: string) => `/stop-plan?phase=${encodeURIComponent(phaseId)}`;

/** The defects list (S28.1), of the project or of one phase. */
export const issuesPath = (phaseId?: string | null) => (phaseId ? `/issues?phase=${encodeURIComponent(phaseId)}` : '/issues');
/** Record a defect (S28.2); optionally from a phase, or from a checklist item with a problem (S26.2). */
export const newIssuePath = (from: { phaseId?: string | null; checklistId?: string; itemId?: string } = {}) => {
  const q = new URLSearchParams();
  if (from.phaseId) q.set('phase', from.phaseId);
  if (from.checklistId) q.set('checklist', from.checklistId);
  if (from.itemId) q.set('item', from.itemId);
  const s = q.toString();
  return s ? `/issues/new?${s}` : '/issues/new';
};
/** Follow one defect (S28.3). */
export const issuePath = (id: string) => `/issues/${id}`;

/** The concrete log (S27.1), of the project or of one phase. */
export const concretePath = (phaseId?: string | null) => (phaseId ? `/concrete?phase=${encodeURIComponent(phaseId)}` : '/concrete');
/** Record a pour (S27.2). */
export const newPourPath = (phaseId?: string | null) => (phaseId ? `/concrete/new?phase=${encodeURIComponent(phaseId)}` : '/concrete/new');
/** One pour, with its reminders. */
export const pourPath = (id: string) => `/concrete/${id}`;
