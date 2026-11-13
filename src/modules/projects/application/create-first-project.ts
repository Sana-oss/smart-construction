import { toDb } from '@/shared-kernel';
import { planInitialPhases } from '../domain/phase-plan';
import {
  validateBudget,
  validateProjectDetails,
  type BudgetInput,
  type ProjectDetailsInput,
  type SetupError,
} from '../domain/project-setup';
import type { CreateProjectOutcome, ProjectGateway } from './project-gateway';

// Use case: create the owner's first project from the wizard answers (FR-PRJ-01). Runs on the SERVER: the
// browser already checked the same rules for instant feedback, but nothing from the browser is trusted.

export interface WizardDraft extends ProjectDetailsInput, BudgetInput {
  currentPhase?: number | null;
  overBudgetConfirmed?: boolean;
}

export type CreateFirstProjectResult =
  | { ok: true; projectId: string }
  | { ok: false; kind: 'invalid'; errors: SetupError[] }
  | { ok: false; kind: 'needs_confirmation' } // spent before > total and the owner did not confirm (D2)
  | { ok: false; kind: 'failed'; reason: Extract<CreateProjectOutcome, { status: 'failed' }>['reason'] };

export async function createFirstProject(gateway: ProjectGateway, draft: WizardDraft): Promise<CreateFirstProjectResult> {
  const details = validateProjectDetails(draft);
  const budget = validateBudget(draft);
  const template = await gateway.phaseTemplate();
  const phases = planInitialPhases(template, draft.currentPhase);

  const errors: SetupError[] = [
    ...(details.ok ? [] : details.errors),
    ...(budget.ok ? [] : budget.errors),
    ...(phases.ok ? [] : [{ field: 'currentPhase' as const, code: 'required' as const }]),
  ];
  if (!details.ok || !budget.ok || !phases.ok) return { ok: false, kind: 'invalid', errors };

  const confirmed = draft.overBudgetConfirmed === true;
  if (budget.value.overBudget && !confirmed) return { ok: false, kind: 'needs_confirmation' };

  const outcome = await gateway.createFirstProject({
    ...details.value,
    totalBudgetLyd: toDb(budget.value.totalBudget),
    availableNowLyd: toDb(budget.value.availableNow),
    spentBeforeLyd: toDb(budget.value.spentBefore),
    contingencyPct: budget.value.contingencyPct.toFixed(2),
    phases: phases.value,
    // Only logged when it was actually needed (an over-budget start that the owner confirmed).
    overBudgetConfirmed: budget.value.overBudget && confirmed,
  });
  return outcome.status === 'created'
    ? { ok: true, projectId: outcome.projectId }
    : { ok: false, kind: 'failed', reason: outcome.reason };
}
