import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtraRecord, ExtraStore } from '../application/extras';
import { isExtraStatus } from '../domain/extras';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for extra works (table change_orders). Always used with the signed-in user's client, so RLS decides
// (0001: members read, writers write). Contracts are not built: contract_id is never written here.

interface ExtraRow {
  id: string;
  title: string;
  cost_lyd: string;
  status: string;
  occurred_on: string;
  phase_id: string | null;
  note: string | null;
  created_at: string;
}

export function toExtraRecord(r: ExtraRow): ExtraRecord | null {
  return isExtraStatus(r.status)
    ? { id: r.id, title: r.title, costLyd: r.cost_lyd, status: r.status, occurredOn: r.occurred_on, phaseId: r.phase_id, note: r.note, createdAt: r.created_at }
    : null;
}

export function supabaseExtraStore(supabase: SupabaseClient): ExtraStore {
  return {
    async list(projectId) {
      // The cost arrives as text, never as a JS number (data rules).
      const { data, error, count } = await supabase
        .from('change_orders')
        .select('id, title, cost_lyd::text, status, occurred_on, phase_id, note, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .returns<ExtraRow[]>();
      if (error) throw new Error(`extra works unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: a partial list would give a wrong approved total.
      if (count !== null && rows.length < count) throw new Error(`extra works incomplete: got ${rows.length} of ${count}`);
      return rows.map(toExtraRecord).filter((r): r is ExtraRecord => r !== null);
    },

    async add(e) {
      const row: Record<string, unknown> = {
        project_id: e.projectId,
        title: e.title,
        cost_lyd: e.costLyd,
        status: e.status,
        phase_id: e.phaseId,
        note: e.note,
      };
      if (e.occurredOn) row.occurred_on = e.occurredOn; // otherwise the database's default: today in Libya
      const { error } = await supabase.from('change_orders').insert(row);
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async setStatus(projectId, id, status) {
      const { data, error } = await supabase.from('change_orders').update({ status }).eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },

    async remove(projectId, id) {
      const { data, error } = await supabase.from('change_orders').delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
