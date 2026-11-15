import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { recordedExpensesLyd } from './recorded-expenses';

// A fake Supabase client that records the query and answers with a fixed result.
function fakeSupabase(result: { data: unknown; error: { message: string } | null }) {
  const calls: unknown[][] = [];
  const query = {
    select: (...a: unknown[]) => (calls.push(['select', ...a]), query),
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), query),
    maybeSingle: async () => result,
  };
  const client = { from: (...a: unknown[]) => (calls.push(['from', ...a]), query) };
  return { client: client as unknown as SupabaseClient, calls };
}

describe('recordedExpensesLyd', () => {
  it('reads one total from the budget_summary view, as text', async () => {
    const { client, calls } = fakeSupabase({ data: { spent_lyd: '12500.5' }, error: null });
    expect(await recordedExpensesLyd(client, 'p1')).toBe('12500.500');
    expect(calls).toEqual([
      ['from', 'budget_summary'],
      ['select', 'spent_lyd::text'],
      ['eq', 'project_id', 'p1'],
    ]);
  });

  it('keeps large totals exact (no JS number on the way)', async () => {
    const { client } = fakeSupabase({ data: { spent_lyd: '12345678901.123' }, error: null });
    expect(await recordedExpensesLyd(client, 'p1')).toBe('12345678901.123');
  });

  it('gives zero when the project is not visible', async () => {
    const { client } = fakeSupabase({ data: null, error: null });
    expect(await recordedExpensesLyd(client, 'p1')).toBe('0.000');
  });

  it('throws when the database fails, instead of showing a wrong total', async () => {
    const { client } = fakeSupabase({ data: null, error: { message: 'boom' } });
    await expect(recordedExpensesLyd(client, 'p1')).rejects.toThrow('expenses total unavailable');
  });
});
