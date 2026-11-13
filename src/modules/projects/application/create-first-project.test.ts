import { describe, expect, it, vi } from 'vitest';
import { createFirstProject, type WizardDraft } from './create-first-project';
import type { ProjectGateway } from './project-gateway';

const template = [
  { position: 1, name: 'الحفر والأساسات', description: null, status: 'unreviewed' as const },
  { position: 2, name: 'الهيكل الخرساني', description: null, status: 'unreviewed' as const },
];

function fakeGateway(overrides: Partial<ProjectGateway> = {}): ProjectGateway {
  return {
    phaseTemplate: vi.fn(async () => template),
    myProject: vi.fn(async () => null),
    createFirstProject: vi.fn(async () => ({ status: 'created' as const, projectId: 'p1' })),
    ...overrides,
  };
}

const draft: WizardDraft = {
  name: 'فيلا النخيل',
  city: 'طرابلس',
  projectType: 'new',
  buildingArea: '240',
  totalBudget: '450,000',
  availableNow: '180000',
  spentBefore: '125000',
  contingencyPct: '10',
  currentPhase: 2,
};

describe('createFirstProject', () => {
  it('sends validated values as decimal strings and the planned phases', async () => {
    const gw = fakeGateway();
    expect(await createFirstProject(gw, draft)).toEqual({ ok: true, projectId: 'p1' });
    expect(gw.createFirstProject).toHaveBeenCalledWith({
      name: 'فيلا النخيل',
      city: 'طرابلس',
      projectType: 'new',
      buildingAreaM2: '240',
      totalBudgetLyd: '450000.000',
      availableNowLyd: '180000.000',
      spentBeforeLyd: '125000.000',
      contingencyPct: '10.00',
      phases: [
        { position: 1, name: 'الحفر والأساسات', status: 'done' },
        { position: 2, name: 'الهيكل الخرساني', status: 'in_progress' },
      ],
      overBudgetConfirmed: false,
    });
  });

  it('never stores invalid input', async () => {
    const gw = fakeGateway();
    const r = await createFirstProject(gw, { ...draft, name: '', currentPhase: null });
    expect(r).toMatchObject({ ok: false, kind: 'invalid' });
    expect(gw.createFirstProject).not.toHaveBeenCalled();
  });

  it('asks for confirmation when spending before the app exceeds the budget (D2)', async () => {
    const gw = fakeGateway();
    expect(await createFirstProject(gw, { ...draft, spentBefore: '500000' })).toEqual({ ok: false, kind: 'needs_confirmation' });
    expect(gw.createFirstProject).not.toHaveBeenCalled();
  });

  it('creates it after confirmation, and asks the database to log the confirmation', async () => {
    const gw = fakeGateway();
    await createFirstProject(gw, { ...draft, spentBefore: '500000', overBudgetConfirmed: true });
    expect(gw.createFirstProject).toHaveBeenCalledWith(expect.objectContaining({ overBudgetConfirmed: true }));
  });

  it('does not log a confirmation that was not needed', async () => {
    const gw = fakeGateway();
    await createFirstProject(gw, { ...draft, overBudgetConfirmed: true });
    expect(gw.createFirstProject).toHaveBeenCalledWith(expect.objectContaining({ overBudgetConfirmed: false }));
  });

  it('passes on storage failures', async () => {
    const gw = fakeGateway({ createFirstProject: async () => ({ status: 'failed', reason: 'already_has_project' }) });
    expect(await createFirstProject(gw, draft)).toEqual({ ok: false, kind: 'failed', reason: 'already_has_project' });
  });
});
