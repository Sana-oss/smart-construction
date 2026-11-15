import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewExpenseRecord } from '../application/expense-gateway';
import { mapExpenseError, supabaseExpenseGateway } from './supabase-expense-gateway';

const expense: NewExpenseRecord = {
  projectId: '11111111-1111-4111-8111-111111111111',
  amountLyd: '2500.750',
  categoryId: null,
  phaseId: null,
  note: null,
  paidOn: null,
  clientOpId: '33333333-3333-4333-8333-333333333333',
};

function fakeSupabase(result: { data: unknown; error: { code?: string; message?: string } | null }) {
  const rpc = vi.fn(async () => result);
  return { client: { rpc } as unknown as SupabaseClient, rpc };
}

describe('mapExpenseError', () => {
  it.each([
    ['42501', 'not_allowed'],
    ['23503', 'unknown_reference'],
    ['23514', 'rejected'],
    ['22003', 'rejected'],
    ['XX000', 'unavailable'],
    [undefined, 'unavailable'],
  ] as const)('maps %s to %s', (code, expected) => {
    expect(mapExpenseError({ code })).toBe(expected);
  });
});

describe('supabaseExpenseGateway.createExpense', () => {
  it('calls create_expense with the amount as a string, never a number', async () => {
    const { client, rpc } = fakeSupabase({ data: [{ expense_id: 'e1', created: true }], error: null });
    expect(await supabaseExpenseGateway(client).createExpense(expense)).toEqual({ status: 'created', expenseId: 'e1' });
    expect(rpc).toHaveBeenCalledWith('create_expense', {
      p_project_id: expense.projectId,
      p_amount_lyd: '2500.750',
      p_client_op_id: expense.clientOpId,
      p_category_id: null,
      p_phase_id: null,
      p_note: null,
      p_paid_on: null,
    });
  });

  it('reports a repeated request as a duplicate with the original id', async () => {
    const { client } = fakeSupabase({ data: [{ expense_id: 'e-original', created: false }], error: null });
    expect(await supabaseExpenseGateway(client).createExpense(expense)).toEqual({ status: 'duplicate', expenseId: 'e-original' });
  });

  it('translates a database error', async () => {
    const { client } = fakeSupabase({ data: null, error: { code: '42501', message: 'new row violates row-level security policy' } });
    expect(await supabaseExpenseGateway(client).createExpense(expense)).toEqual({ status: 'failed', reason: 'not_allowed' });
  });

  it('never invents a success from an empty answer', async () => {
    const { client } = fakeSupabase({ data: [], error: null });
    expect(await supabaseExpenseGateway(client).createExpense(expense)).toEqual({ status: 'failed', reason: 'unavailable' });
  });
});
