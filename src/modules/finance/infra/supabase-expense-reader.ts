import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExpenseCriteria, ExpenseListItem, ExpenseReader } from '../application/list-expenses';
import { EXPENSE_TYPES, type ExpenseType } from '../domain/expense';

// Supabase adapter for the expenses list. Always used with the signed-in user's client, so RLS decides what is
// visible (a stranger gets no rows). Reads only the finance module's own table, expenses; phase names come from
// the projects module through the page (rule 4: each module touches only its own tables).

interface ExpenseRow {
  id: string;
  title: string | null;
  amount_lyd: string;
  expense_type: string | null;
  phase_id: string | null;
  payee: string | null;
  paid_on: string;
  receipt_path: string | null;
}

const isExpenseType = (v: unknown): v is ExpenseType => (EXPENSE_TYPES as readonly unknown[]).includes(v);

/**
 * Row -> list item. Rows from before migration 0009 may have no title or type; they are shown with an empty name
 * and no type rather than hidden, so the list always matches the totals.
 */
export function toListItem(row: ExpenseRow): ExpenseListItem {
  return {
    id: row.id,
    title: row.title ?? '',
    amountLyd: row.amount_lyd,
    expenseType: isExpenseType(row.expense_type) ? row.expense_type : null,
    phaseId: row.phase_id,
    payee: row.payee,
    paidOn: row.paid_on,
    receiptPath: row.receipt_path ?? null,
  };
}

/** The few query methods the criteria need (Supabase's filter builder has them all). */
interface Filterable {
  gte(column: string, value: string): this;
  lt(column: string, value: string): this;
  eq(column: string, value: string): this;
  or(filters: string): this;
}

/**
 * Adds the criteria (design S13.2) to a query. The search was cleaned by the domain (letters, digits, spaces only), so
 * it cannot break the filter text; its spaces become "*" (any text), so «حديد تسليح» also finds «حديد 12 تسليح».
 */
export function applyCriteria<Q extends Filterable>(query: Q, c: ExpenseCriteria): Q {
  let q = query;
  if (c.range) q = q.gte('paid_on', c.range.from).lt('paid_on', c.range.to);
  if (c.phaseId) q = q.eq('phase_id', c.phaseId);
  if (c.expenseType) q = q.eq('expense_type', c.expenseType);
  if (c.search) {
    const pattern = `*${c.search.split(' ').join('*')}*`;
    q = q.or(`title.ilike.${pattern},payee.ilike.${pattern}`);
  }
  return q;
}

export function supabaseExpenseReader(supabase: SupabaseClient): ExpenseReader {
  return {
    async recentExpenses(projectId, limit, criteria) {
      // "amount_lyd::text": the amount arrives as text, so it never passes through a JS number (data rules).
      const query = supabase
        .from('expenses')
        .select('id, title, amount_lyd::text, expense_type, phase_id, payee, paid_on, receipt_path', { count: 'exact' })
        .eq('project_id', projectId);
      const { data, error, count } = await applyCriteria(query, criteria)
        .order('paid_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(limit)
        .returns<ExpenseRow[]>();
      if (error) throw new Error(`expenses list unavailable: ${error.message}`);
      const items = (data ?? []).map(toListItem);
      return { items, totalCount: count ?? items.length };
    },

    async expenseById(projectId, expenseId) {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, title, amount_lyd::text, expense_type, phase_id, payee, paid_on, receipt_path')
        .eq('project_id', projectId)
        .eq('id', expenseId)
        .returns<ExpenseRow[]>()
        .maybeSingle();
      if (error) throw new Error(`expense unavailable: ${error.message}`);
      return data ? toListItem(data as ExpenseRow) : null;
    },

    async amountsMatching(projectId, criteria) {
      const query = supabase.from('expenses').select('amount_lyd::text', { count: 'exact' }).eq('project_id', projectId);
      const { data, error, count } = await applyCriteria(query, criteria).returns<{ amount_lyd: string }[]>();
      if (error) throw new Error(`expense amounts unavailable: ${error.message}`);
      const amounts = (data ?? []).map((r) => r.amount_lyd);
      // Supabase caps a response at 1,000 rows. Fewer rows than the count = an incomplete list: refuse it.
      if (count !== null && amounts.length < count) {
        throw new Error(`expense amounts incomplete: got ${amounts.length} of ${count}`);
      }
      return amounts;
    },
  };
}
