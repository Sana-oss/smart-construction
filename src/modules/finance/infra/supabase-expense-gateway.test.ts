import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { NewExpenseRecord } from '../application/expense-gateway';
import { mapExpenseError, supabaseExpenseEditor, supabaseExpenseGateway } from './supabase-expense-gateway';

const expense: NewExpenseRecord = {
  projectId: '11111111-1111-4111-8111-111111111111',
  title: 'حديد تسليح',
  amountLyd: '12000.750',
  expenseType: 'materials',
  phaseId: null,
  payee: 'مورد الحديد',
  paidOn: null,
  clientOpId: '33333333-3333-4333-8333-333333333333',
  receiptPath: null,
  foreign: null,
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
      p_amount_lyd: '12000.750',
      p_client_op_id: expense.clientOpId,
      p_title: 'حديد تسليح',
      p_expense_type: 'materials',
      p_phase_id: null,
      p_payee: 'مورد الحديد',
      p_paid_on: null,
      p_receipt_path: null,
      p_original_amount: null,
      p_original_currency: null,
      p_rate_lyd_per_unit: null,
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

/** A stand-in for supabase.from('expenses').update(...)/.delete() ... .select(): records the calls, gives `result`. */
function fakeTable(result: { data: unknown; error: { code?: string } | null }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const chain: Record<string, unknown> = {};
  for (const m of ['update', 'delete', 'eq', 'select', 'returns']) {
    chain[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return chain;
    };
  }
  chain.then = (resolve: (v: unknown) => unknown) => resolve(result);
  const from = vi.fn(() => chain);
  return { client: { from } as unknown as SupabaseClient, calls, from };
}

describe('supabaseExpenseEditor', () => {
  const PROJECT = '11111111-1111-4111-8111-111111111111';
  const change = {
    projectId: PROJECT,
    expenseId: 'e1',
    title: 'رمل',
    amountLyd: '650.250',
    expenseType: 'services' as const,
    phaseId: null,
    payee: null,
    paidOn: '2026-11-10',
    foreign: null,
  };

  it('updates only the editable fields of the expense of this project, with the amount as a string', async () => {
    const { client, calls, from } = fakeTable({ data: [{ id: 'e1' }], error: null });
    expect(await supabaseExpenseEditor(client).updateExpense(change)).toEqual({ status: 'done' });
    expect(from).toHaveBeenCalledWith('expenses');
    expect(calls).toContainEqual({
      method: 'update',
      args: [
        {
          title: 'رمل',
          amount_lyd: '650.250',
          expense_type: 'services',
          phase_id: null,
          payee: null,
          paid_on: '2026-11-10',
          original_amount: null,
          original_currency: null,
          rate_lyd_per_unit: null,
        },
      ],
    });
    expect(calls).toContainEqual({ method: 'eq', args: ['id', 'e1'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['project_id', PROJECT] });
  });

  it('reports "not found" when no row was changed (RLS hides it, or it is gone)', async () => {
    const { client } = fakeTable({ data: [], error: null });
    expect(await supabaseExpenseEditor(client).updateExpense(change)).toEqual({ status: 'failed', reason: 'not_found' });
    expect(await supabaseExpenseEditor(client).deleteExpense(PROJECT, 'e1')).toEqual({ status: 'failed', reason: 'not_found' });
  });

  it('translates a refusal of the edit guard', async () => {
    const { client } = fakeTable({ data: null, error: { code: '23503' } });
    expect(await supabaseExpenseEditor(client).updateExpense(change)).toEqual({ status: 'failed', reason: 'unknown_reference' });
  });

  it('deletes and gives back the receipt path for the app to remove', async () => {
    const { client, calls } = fakeTable({ data: [{ receipt_path: `${PROJECT}/receipts/r.jpg` }], error: null });
    expect(await supabaseExpenseEditor(client).deleteExpense(PROJECT, 'e1')).toEqual({ status: 'done', receiptPath: `${PROJECT}/receipts/r.jpg` });
    expect(calls.map((c) => c.method)).toContain('delete');
  });
});

describe('foreign currency reaches the database (3.18)', () => {
  it('create_expense gets the original amount, currency and rate', async () => {
    const { client, rpc } = fakeSupabase({ data: [{ expense_id: 'e1', created: true }], error: null });
    const foreign = { currency: 'USD' as const, originalAmount: '1000.000', rateLydPerUnit: '7.2500' };
    await supabaseExpenseGateway(client).createExpense({ ...expense, amountLyd: '7250.000', foreign });
    expect(rpc).toHaveBeenCalledWith(
      'create_expense',
      expect.objectContaining({ p_amount_lyd: '7250.000', p_original_amount: '1000.000', p_original_currency: 'USD', p_rate_lyd_per_unit: '7.2500' }),
    );
  });
});
