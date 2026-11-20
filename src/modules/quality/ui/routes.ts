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
