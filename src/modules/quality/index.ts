// Public API of the quality module. Other code imports ONLY from "@/modules/quality".
// See docs/system_architecture.md section 4 for the tables and features this module owns.
// Built so far: pre-pour checkpoints, slice 1 (3.12; FR-QLT-01, FR-QLT-02; design S26.1, S26.2; 20 Nov 2026).

export { PhaseChecklists } from './ui/PhaseChecklists';
export { NewChecklistForm } from './ui/NewChecklistForm';
export { ChecklistScreen } from './ui/ChecklistScreen';
export { CheckItemForm } from './ui/CheckItemForm';
export { createChecklistAction, recordCheckAction } from './ui/checklist-actions';
export { ReadinessScreen } from './ui/ReadinessScreen';
export { getReadinessGapsAr, getReadinessView } from './ui/queries';
export { readinessTextAr } from './ui/messages.ar';
export { READINESS_PATH } from './ui/routes';
export { StopPlanScreen } from './ui/StopPlanScreen';
export { getStopPlanProgress, getStopPlanView } from './ui/queries';
export { stopPlanTextAr } from './ui/messages.ar';
export { stopPlanPath } from './ui/routes';

// The defects list (3.17; S28.1, S28.2, S28.3)
export { IssuesList } from './ui/IssuesList';
export { IssueForm } from './ui/IssueForm';
export { IssueDetailScreen } from './ui/IssueDetailScreen';
export { getIssueListView, getIssueView, getOpenIssueCounts, getOpenIssuesOfPhaseAr } from './ui/issue-queries';
export { issueTextAr, openCountAr } from './ui/messages.ar';
export { issuePath, issuesPath, newIssuePath } from './ui/routes';
export { protectionCostText } from './application/checklists';
export { getChecklistCountsView, getChecklistDetailView, getChecklistTemplates, getCheckPhotoUrl, getPhaseChecklistsView } from './ui/queries';
export { checklistTextAr, ENGINEER_NOTE_AR } from './ui/messages.ar';
export { checklistPath, checkItemPath, newChecklistPath, phaseChecklistsPath } from './ui/routes';
