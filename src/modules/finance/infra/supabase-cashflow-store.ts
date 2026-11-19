import type { SupabaseClient } from '@supabase/supabase-js';
import type { CashflowStore, MovementItem } from '../application/cashflow';
import type { MovementKind } from '../domain/cashflow';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for obligations and expected income (S16). Always used with the signed-in user's client, so RLS
// decides (0002: members read, writers write). The two tables have different column names for the same idea; this
// file is the only place that knows them.

const TABLE = {
  obligation: { name: 'obligations', date: 'due_on', party: 'creditor' },
  income: { name: 'expected_income', date: 'expected_on', party: 'source' },
} as const;

export function supabaseCashflowStore(supabase: SupabaseClient): CashflowStore {
  return {
    async movements(projectId) {
      // "amount_lyd::text": the amount arrives as text, never as a JS number (data rules).
      const [ob, inc] = await Promise.all([
        supabase
          .from('obligations')
          .select('id, title, amount_lyd::text, due_on, creditor')
          .eq('project_id', projectId)
          .returns<{ id: string; title: string; amount_lyd: string; due_on: string; creditor: string }[]>(),
        supabase
          .from('expected_income')
          .select('id, title, amount_lyd::text, expected_on, source')
          .eq('project_id', projectId)
          .returns<{ id: string; title: string; amount_lyd: string; expected_on: string; source: string }[]>(),
      ]);
      if (ob.error || inc.error) throw new Error(`movements unavailable: ${(ob.error ?? inc.error)!.message}`);
      const items: MovementItem[] = [
        ...(ob.data ?? []).map((r) => ({ id: r.id, kind: 'obligation' as const, title: r.title, amountLyd: r.amount_lyd, date: r.due_on, party: r.creditor })),
        ...(inc.data ?? []).map((r) => ({ id: r.id, kind: 'income' as const, title: r.title, amountLyd: r.amount_lyd, date: r.expected_on, party: r.source })),
      ];
      return items;
    },

    async expensesPaidSince(projectId, since) {
      const { data, error, count } = await supabase
        .from('expenses')
        .select('amount_lyd::text, paid_on', { count: 'exact' })
        .eq('project_id', projectId)
        .gte('paid_on', since)
        .returns<{ amount_lyd: string; paid_on: string }[]>();
      if (error) throw new Error(`expenses unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: fewer rows than the count would give a wrong liquidity.
      if (count !== null && rows.length < count) throw new Error(`expenses incomplete: got ${rows.length} of ${count}`);
      return rows.map((r) => ({ amountLyd: r.amount_lyd, paidOn: r.paid_on }));
    },

    async add(m) {
      const t = TABLE[m.kind];
      const { error } = await supabase.from(t.name).insert({
        project_id: m.projectId,
        title: m.title,
        amount_lyd: m.amountLyd, // a decimal string; PostgreSQL reads it as numeric
        [t.date]: m.date,
        [t.party]: m.party,
      });
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async remove(projectId, kind: MovementKind, id) {
      const { data, error } = await supabase.from(TABLE[kind].name).delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
