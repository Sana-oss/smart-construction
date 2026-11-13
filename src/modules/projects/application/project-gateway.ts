import type { PhaseStatus, PhaseTemplateRow, PlannedPhase } from '../domain/phase-plan';
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
  phases: { position: number; name: string; status: PhaseStatus }[];
}

export type CreateProjectOutcome =
  | { status: 'created'; projectId: string }
  | { status: 'failed'; reason: 'already_has_project' | 'not_signed_in' | 'unavailable' };

export interface ProjectGateway {
  phaseTemplate(): Promise<TemplatePhase[]>;
  /** The signed-in owner's project (one per owner for now, decision 10), or null. */
  myProject(): Promise<MyProject | null>;
  createFirstProject(project: NewProject): Promise<CreateProjectOutcome>;
}
