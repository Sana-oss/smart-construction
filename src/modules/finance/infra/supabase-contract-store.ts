import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContractRecord, ContractStore, PaymentRecord } from '../application/contracts';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for contracts and their payment schedule (tables contracts, payments). Always used with the
// signed-in user's client, so RLS decides (0001: members read, writers write); the guards and audit are the database's (0031).

interface ContractRow {
  id: string;
  title: string;
  contractor: string;
  value_lyd: string;
  scope: string | null;
  cleanup_clause: string | null;
  document_id: string | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  contract_id: string;
  title: string;
  amount_lyd: string;
  retained_lyd: string;
  phase_id: string | null;
  paid_on: string | null;
  created_at: string;
}

export const toContractRecord = (r: ContractRow): ContractRecord => ({
  id: r.id,
  title: r.title,
  contractor: r.contractor,
  valueLyd: r.value_lyd,
  scope: r.scope,
  cleanupClause: r.cleanup_clause,
  documentId: r.document_id,
  createdAt: r.created_at,
});

export const toPaymentRecord = (r: PaymentRow): PaymentRecord => ({
  id: r.id,
  contractId: r.contract_id,
  title: r.title,
  amountLyd: r.amount_lyd,
  retainedLyd: r.retained_lyd,
  phaseId: r.phase_id,
  paidOn: r.paid_on,
  createdAt: r.created_at,
});

export function supabaseContractStore(supabase: SupabaseClient): ContractStore {
  return {
    async listContracts(projectId) {
      // Money arrives as text, never as a JS number (data rules).
      const { data, error, count } = await supabase
        .from('contracts')
        .select('id, title, contractor, value_lyd::text, scope, cleanup_clause, document_id, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<ContractRow[]>();
      if (error) throw new Error(`contracts unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: a partial list would give wrong totals.
      if (count !== null && rows.length < count) throw new Error(`contracts incomplete: got ${rows.length} of ${count}`);
      return rows.map(toContractRecord);
    },

    async listPayments(projectId) {
      const { data, error, count } = await supabase
        .from('payments')
        .select('id, contract_id, title, amount_lyd::text, retained_lyd::text, phase_id, paid_on, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .returns<PaymentRow[]>();
      if (error) throw new Error(`payments unavailable: ${error.message}`);
      const rows = data ?? [];
      if (count !== null && rows.length < count) throw new Error(`payments incomplete: got ${rows.length} of ${count}`);
      return rows.map(toPaymentRecord);
    },

    async addContract(c) {
      const { data, error } = await supabase
        .from('contracts')
        .insert({
          project_id: c.projectId,
          title: c.title,
          contractor: c.contractor,
          value_lyd: c.valueLyd,
          scope: c.scope,
          cleanup_clause: c.cleanupClause,
          document_id: c.documentId,
        })
        .select('id')
        .single<{ id: string }>();
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data ? { status: 'done', id: data.id } : { status: 'failed', reason: 'unavailable' };
    },

    async addPayment(p) {
      const { error } = await supabase.from('payments').insert({
        project_id: p.projectId,
        contract_id: p.contractId,
        title: p.title,
        amount_lyd: p.amountLyd,
        retained_lyd: p.retainedLyd,
        phase_id: p.phaseId,
      });
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async removeContract(projectId, id) {
      const { data, error } = await supabase.from('contracts').delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },

    async removePayment(projectId, id) {
      const { data, error } = await supabase.from('payments').delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
