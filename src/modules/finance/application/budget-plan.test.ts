import { describe, expect, it, vi } from 'vitest';
import { getBudgetView, saveAllocations, type BudgetStore } from './budget-plan';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function fakeStore(allocations: [string, string][] = [], expenses: { phaseId: string | null; amountLyd: string }[] = []) {
  const store: BudgetStore = {
    allocations: vi.fn(async () => new Map(allocations)),
    expensesByPhase: vi.fn(async () => expenses),
    saveAllocations: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

const project = { id: PROJECT, totalBudgetLyd: '450000.000', spentBeforeLyd: '5000.000', contingencyPct: '5', phases: [{ id: A }, { id: B }] };

describe('getBudgetView (S15.1, S15.2)', () => {
  it('combines the summary (as on the dashboard) with the plan per phase', async () => {
    const store = fakeStore(
      [[A, '60000.000']],
      [
        { phaseId: A, amountLyd: '70000.000' },
        { phaseId: null, amountLyd: '250.000' },
      ],
    );
    const v = await getBudgetView(store, project);
    expect(v.summary.spent.toFixed(3)).toBe('75250.000'); // 5,000 before + 70,000 + 250
    expect(v.summary.remaining.toFixed(3)).toBe('374750.000');
    expect(v.summary.contingency.toFixed(3)).toBe('22500.000');
    expect(v.plan.rows.map((r) => [r.phaseId, r.allocated?.toFixed(3) ?? null, r.spent.toFixed(3), r.over])).toEqual([
      [A, '60000.000', '70000.000', true], // 70,000 > 66,000
      [B, null, '0.000', false],
    ]);
    expect(v.plan.unassigned.toFixed(3)).toBe('250.000');
    expect(v.plan.forPhases.toFixed(3)).toBe('427500.000');
  });
});

describe('saveAllocations', () => {
  it('sets typed amounts and clears empty ones', async () => {
    const store = fakeStore();
    expect(await saveAllocations(store, { projectId: PROJECT, allocations: { [A]: '60,000', [B]: '' } }, [A, B])).toEqual({ ok: true });
    expect(store.saveAllocations).toHaveBeenCalledWith(PROJECT, [
      { phaseId: A, amountLyd: '60000.000' },
      { phaseId: B, amountLyd: null },
    ]);
  });

  it('never calls the database when an amount is wrong or a phase is foreign', async () => {
    const store = fakeStore();
    const r = await saveAllocations(store, { projectId: PROJECT, allocations: { [A]: 'abc' } }, [A]);
    expect(r).toEqual({ ok: false, kind: 'invalid', errors: [{ phaseId: A, code: 'invalid_number' }] });
    expect(store.saveAllocations).not.toHaveBeenCalled();
  });
});
