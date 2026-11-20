import type { PhaseTemplateRow, PlannedPhase } from '../domain/phase-plan';
import type { PhaseSchedule } from '../domain/phase-schedule';
import type { ProjectType } from '../domain/project-setup';

// Port: what the projects use cases need from storage. The Supabase adapter implements it; tests use a fake.

export interface TemplatePhase extends PhaseTemplateRow {
  description: string | null;
  /** 'unreviewed' until an engineer approves the template (CLAUDE.md: engineering content is reviewed data). */
  status: 'unreviewed' | 'approved';
}

export interface NewProject {
  name: string;
  city: string;
  projectType: ProjectType;
  buildingAreaM2: string;
  /** Money as canonical decimal strings (never JS numbers). */
  totalBudgetLyd: string;
  availableNowLyd: string;
  spentBeforeLyd: string;
  contingencyPct: string;
  phases: PlannedPhase[];
  overBudgetConfirmed: boolean;
}

export interface MyProject {
  id: string;
  name: string;
  city: string | null;
  projectType: ProjectType;
  buildingAreaM2: string | null;
  totalBudgetLyd: string;
  spentBeforeLyd: string;
  contingencyPct: string;
  availableNowLyd: string | null;
  availableAsOf: string | null;
  /**
   * Sorted by position. id: needed by other modules to link a row to a phase (for example an expense).
   * Status and the four dates: FR-PRJ-03 (the phases screen, S09.1).
   */
  phases: ProjectPhase[];
}

export interface ProjectPhase extends PhaseSchedule {
  id: string;
  position: number;
  name: string;
}

export type PhaseUpdateFailure =
  | 'not_allowed' // not signed in, or no write access to this phase (RLS)
  | 'rejected' // the database refused the values (its own check of the same rules)
  | 'unavailable';

export type CreateProjectOutcome =
  | { status: 'created'; projectId: string }
  | { status: 'failed'; reason: 'already_has_project' | 'not_signed_in' | 'unavailable' };

export interface ProjectGateway {
  phaseTemplate(): Promise<TemplatePhase[]>;
  /** The signed-in owner's project (one per owner for now, decision 10), or null. */
  myProject(): Promise<MyProject | null>;
  createFirstProject(project: NewProject): Promise<CreateProjectOutcome>;
  /**
   * Changes only the status and the four dates of one phase, with an audit row, in one transaction (0010).
   * startGaps (0027): the readiness gaps the owner confirmed when starting the phase; logged in the same transaction.
   */
  updatePhaseSchedule(
    phaseId: string,
    schedule: PhaseSchedule,
    startGaps?: string[] | null,
  ): Promise<{ status: 'updated' } | { status: 'failed'; reason: PhaseUpdateFailure }>;
}
