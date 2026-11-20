import type { SupabaseClient } from '@supabase/supabase-js';
import type { RateStore } from '../application/rates';
import { isCurrency, type RateRecord } from '../domain/currency';
import { mapExpenseError } from './supabase-expense-gateway';

// Supabase adapter for the reference rates log (table exchange_rates). Always used with the signed-in user's client, so
// RLS decides (0001: members read, writers write).

interface RateRow {
  id: string;
  currency: string;
  lyd_per_unit: string;
  rate_date: string;
  note: string | null;
  created_at: string;
}

/** Row -> record. A row with a currency outside the list (impossible after 0020) is left out rather than guessed. */
export function toRateRecord(r: RateRow): RateRecord | null {
  return isCurrency(r.currency)
    ? { id: r.id, currency: r.currency, lydPerUnit: r.lyd_per_unit, rateDate: r.rate_date, note: r.note, createdAt: r.created_at }
    : null;
}

export function supabaseRateStore(supabase: SupabaseClient): RateStore {
  return {
    async list(projectId) {
      // The rate arrives as text ("lyd_per_unit::text"): 4 places, never a JS number.
      const { data, error, count } = await supabase
        .from('exchange_rates')
        .select('id, currency, lyd_per_unit::text, rate_date, note, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .returns<RateRow[]>();
      if (error) throw new Error(`rates unavailable: ${error.message}`);
      const rows = data ?? [];
      if (count !== null && rows.length < count) throw new Error(`rates incomplete: got ${rows.length} of ${count}`);
      return rows.map(toRateRecord).filter((r): r is RateRecord => r !== null);
    },

    async add(r) {
      const row: Record<string, unknown> = { project_id: r.projectId, currency: r.currency, lyd_per_unit: r.lydPerUnit, note: r.note };
      if (r.rateDate) row.rate_date = r.rateDate; // otherwise the database's default: today in Libya
      const { error } = await supabase.from('exchange_rates').insert(row);
      return error ? { status: 'failed', reason: mapExpenseError(error) } : { status: 'done' };
    },

    async remove(projectId, id) {
      const { data, error } = await supabase.from('exchange_rates').delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapExpenseError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
