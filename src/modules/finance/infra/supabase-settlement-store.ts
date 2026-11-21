import type { SupabaseClient } from '@supabase/supabase-js';
import type { SettlementStore } from '../application/payment-settlement';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for paying and releasing (migration 0032). Always used with the signed-in user's client, so RLS
// decides. Paying and releasing go through the two SECURITY INVOKER functions, which update the payment and log a
// confirmed warning (D2) in ONE transaction; undoing is a plain update (the audit trigger records it).

export function supabaseSettlementStore(supabase: SupabaseClient): SettlementStore {
  return {
    async markPaid(c) {
      const { error } = await supabase.rpc('confirm_payment_paid', {
        p_payment_id: c.paymentId,
        p_paid_on: c.paidOn,
        p_expense_id: c.expenseId,
        p_gaps: c.gaps === null ? null : [...c.gaps],
      });
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async release(c) {
      const { error } = await supabase.rpc('release_payment_retained', {
        p_payment_id: c.paymentId,
        p_released_on: c.releasedOn,
        p_expense_id: c.expenseId,
        p_early: c.early,
      });
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async markUnpaid(projectId, paymentId) {
      const { data, error } = await supabase
        .from('payments')
        .update({ paid_on: null, expense_id: null })
        .eq('id', paymentId)
        .eq('project_id', projectId)
        .select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },

    async undoRelease(projectId, paymentId) {
      const { data, error } = await supabase
        .from('payments')
        .update({ released_on: null, release_expense_id: null })
        .eq('id', paymentId)
        .eq('project_id', projectId)
        .select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
