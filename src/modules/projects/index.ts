// Public API of the projects module. Other code imports ONLY from "@/modules/projects".
// Owns tables: projects, phases, phase_closing_checks, tasks, phase_templates (architecture §4.3; 0006).

// Domain (pure)
export { validateProjectDetails, validateBudget, DEFAULT_CONTINGENCY_PCT, type ProjectType } from './domain/project-setup';
export { planInitialPhases, type PhaseStatus, type PlannedPhase } from './domain/phase-plan';
export { LIBYA_DISTRICTS } from './domain/libya-districts';

// Types for other modules and pages
export type { MyProject, TemplatePhase } from './application/project-gateway';

// Server-side reads for pages
export { getMyProject, getPhaseTemplate } from './ui/queries';

// First-project wizard (FR-PRJ-01): one component per step + the Server Action of the last step
export { DetailsStep } from './ui/DetailsStep';
export { PhasesStep } from './ui/PhasesStep';
export { BudgetStep } from './ui/BudgetStep';
export { ReviewStep } from './ui/ReviewStep';
export { createFirstProjectAction } from './ui/actions';
export {
  SETUP_DETAILS_PATH,
  SETUP_PHASES_PATH,
  SETUP_BUDGET_PATH,
  SETUP_REVIEW_PATH,
  PROJECT_HOME_PATH,
} from './ui/routes';
