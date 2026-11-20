import { describe, expect, it, vi } from 'vitest';
import type { ProjectGateway } from './project-gateway';
import { updatePhaseSchedule } from './update-phase-schedule';

const TODAY = '2026-11-18';

function fakeGateway(result: Awaited<ReturnType<ProjectGateway['updatePhaseSchedule']>> = { status: 'updated' }) {
  const gateway: ProjectGateway = {
    phaseTemplate: vi.fn(async () => []),
    myProject: vi.fn(async () => null),
    createFirstProject: vi.fn(async () => ({ status: 'created' as const, projectId: 'p1' })),
    updatePhaseSchedule: vi.fn(async () => result),
  };
  return gateway;
}

describe('updatePhaseSchedule', () => {
  it('stores the checked values, with empty dates as null', async () => {
    const gateway = fakeGateway();
    const r = await updatePhaseSchedule(gateway, 'ph1', { status: 'in_progress', plannedEnd: '2027-01-31', actualStart: '' }, TODAY);
    expect(r).toEqual({ ok: true });
    expect(gateway.updatePhaseSchedule).toHaveBeenCalledWith('ph1', {
      status: 'in_progress',
      plannedStart: null,
      plannedEnd: '2027-01-31',
      actualStart: null,
      actualEnd: null,
    }, null, null);
  });

  it('passes on the readiness gaps the owner confirmed when starting the phase (FR-PRJ-05)', async () => {
    const gateway = fakeGateway();
    await updatePhaseSchedule(gateway, 'ph1', { status: 'in_progress' }, TODAY, ['ترخيص البناء (ناقص)']);
    expect(gateway.updatePhaseSchedule).toHaveBeenCalledWith('ph1', expect.objectContaining({ status: 'in_progress' }), ['ترخيص البناء (ناقص)'], null);
  });

  it('does not reach the database with invalid values', async () => {
    const gateway = fakeGateway();
    const r = await updatePhaseSchedule(gateway, 'ph1', { status: 'done', actualEnd: '2026-12-01' }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'actualEnd', code: 'date_in_future' }] });
    expect(gateway.updatePhaseSchedule).not.toHaveBeenCalled();
  });

  it('reports a refusal from the database (for example a stranger, through RLS)', async () => {
    const gateway = fakeGateway({ status: 'failed', reason: 'not_allowed' });
    const r = await updatePhaseSchedule(gateway, 'ph1', { status: 'done' }, TODAY);
    expect(r).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
  });
});
