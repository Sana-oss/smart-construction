import { describe, expect, it, vi } from 'vitest';
import { addTask, changeTaskStatus, removeTask, type TaskGateway } from './tasks';

function fakeGateway(overrides: Partial<TaskGateway> = {}): TaskGateway {
  return {
    projectTasks: vi.fn(async () => []),
    addTask: vi.fn(async () => ({ status: 'added' as const })),
    setTaskStatus: vi.fn(async () => ({ status: 'updated' as const })),
    deleteTask: vi.fn(async () => ({ status: 'deleted' as const })),
    ...overrides,
  };
}

describe('addTask', () => {
  it('stores the checked title and due date', async () => {
    const gateway = fakeGateway();
    expect(await addTask(gateway, 'p1', 'ph1', { title: ' تجهيز الشدة ', dueDate: '' })).toEqual({ ok: true });
    expect(gateway.addTask).toHaveBeenCalledWith('p1', 'ph1', { title: 'تجهيز الشدة', dueDate: null });
  });

  it('does not reach the database with an invalid title', async () => {
    const gateway = fakeGateway();
    const r = await addTask(gateway, 'p1', 'ph1', { title: '' });
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ field: 'title', code: 'required' }] });
    expect(gateway.addTask).not.toHaveBeenCalled();
  });

  it('reports a phase of another project (refused by the database guard)', async () => {
    const gateway = fakeGateway({ addTask: vi.fn(async () => ({ status: 'failed' as const, reason: 'unknown_reference' as const })) });
    expect(await addTask(gateway, 'p1', 'ph-other', { title: 'مهمة' })).toEqual({ ok: false, kind: 'failed', reason: 'unknown_reference' });
  });
});

describe('changeTaskStatus', () => {
  it('passes a known status through', async () => {
    const gateway = fakeGateway();
    expect(await changeTaskStatus(gateway, 't1', 'done')).toEqual({ ok: true });
    expect(gateway.setTaskStatus).toHaveBeenCalledWith('t1', 'done');
  });

  it('refuses an unknown status before the database', async () => {
    const gateway = fakeGateway();
    expect(await changeTaskStatus(gateway, 't1', 'finished')).toEqual({ ok: false, kind: 'failed', reason: 'rejected' });
    expect(gateway.setTaskStatus).not.toHaveBeenCalled();
  });
});

describe('removeTask', () => {
  it('reports a task the user may not delete', async () => {
    const gateway = fakeGateway({ deleteTask: vi.fn(async () => ({ status: 'failed' as const, reason: 'not_allowed' as const })) });
    expect(await removeTask(gateway, 't1')).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
  });
});
