import type { SupabaseClient } from '@supabase/supabase-js';
import type { PriceFailure, PriceStore } from '../application/prices';
import type { PriceRecord } from '../domain/price';

// Supabase adapter for the price log (S24). Always used with the signed-in user's client, so RLS decides (0001: members
// read, writers write). Reads only the materials module's own table, price_records.

/** PostgreSQL error codes -> our reasons, so a raw database message never reaches the owner (NFR-USE-04). */
export function mapPriceError(error: { code?: string }): PriceFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23514': // check: lengths, expiry order, negative price; the guard: future date (0018)
    case '23502':
    case '22003':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface PriceRow {
  id: string;
  material: string;
  unit: string;
  price_lyd: string;
  is_quote: boolean;
  supplier: string | null;
  recorded_on: string;
  quote_expires_on: string | null;
  transport_cost_lyd: string | null;
  note: string | null;
  created_at: string;
}

export function toPriceRecord(r: PriceRow): PriceRecord {
  return {
    id: r.id,
    material: r.material,
    unit: r.unit,
    priceLyd: r.price_lyd,
    kind: r.is_quote ? 'quote' : 'paid',
    supplier: r.supplier,
    recordedOn: r.recorded_on,
    expiresOn: r.quote_expires_on,
    transportLyd: r.transport_cost_lyd,
    note: r.note,
    createdAt: r.created_at,
  };
}

export function supabasePriceStore(supabase: SupabaseClient): PriceStore {
  return {
    async list(projectId) {
      // Money arrives as text ("::text"), never as a JS number (data rules).
      const { data, error, count } = await supabase
        .from('price_records')
        .select(
          'id, material, unit, price_lyd::text, is_quote, supplier, recorded_on, quote_expires_on, transport_cost_lyd::text, note, created_at',
          { count: 'exact' },
        )
        .eq('project_id', projectId)
        .returns<PriceRow[]>();
      if (error) throw new Error(`prices unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: a partial log could hide the newest price.
      if (count !== null && rows.length < count) throw new Error(`prices incomplete: got ${rows.length} of ${count}`);
      return rows.map(toPriceRecord);
    },

    async add(p) {
      const row: Record<string, unknown> = {
        project_id: p.projectId,
        material: p.material,
        unit: p.unit,
        price_lyd: p.priceLyd, // a decimal string; PostgreSQL reads it as numeric
        is_quote: p.kind === 'quote',
        supplier: p.supplier,
        quote_expires_on: p.expiresOn,
        transport_cost_lyd: p.transportLyd,
        note: p.note,
      };
      if (p.recordedOn) row.recorded_on = p.recordedOn; // otherwise the database's default: today in Libya
      const { error } = await supabase.from('price_records').insert(row);
      return error ? { status: 'failed', reason: mapPriceError(error) } : { status: 'done' };
    },

    async remove(projectId, id) {
      const { data, error } = await supabase.from('price_records').delete().eq('id', id).eq('project_id', projectId).select('id');
      if (error) return { status: 'failed', reason: mapPriceError(error) };
      return data && data.length === 1 ? { status: 'done' } : { status: 'failed', reason: 'not_found' };
    },
  };
}
