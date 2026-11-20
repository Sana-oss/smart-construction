import type { SupabaseClient } from '@supabase/supabase-js';
import type { ItemRecord, PurchaseRecord, QuantityFailure, QuantityStore } from '../application/quantities';

// Supabase adapter for the quantity table and purchases (0024). Always used with the signed-in user's client, so RLS
// decides (0001: members read, writers write). Reads and writes only the materials module's own tables.

/** PostgreSQL error codes -> our reasons, so a raw database message never reaches the owner (NFR-USE-04). */
export function mapQuantityError(error: { code?: string; message?: string }): QuantityFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23505': // quantity_items_line_unique: the same material, unit and phase
      return 'duplicate';
    case '23503': // the guards: the phase or the line is not this project's
      return 'unknown_reference';
    case '23514':
      // The guard of 0024 refuses deleting a line that has purchases; every other check is a refused value.
      return /purchases cannot be deleted/.test(error.message ?? '') ? 'has_purchases' : 'rejected';
    case '23502':
    case '22003':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface ItemRow {
  id: string;
  material: string;
  unit: string;
  planned_qty: string;
  waste_pct: string;
  phase_id: string | null;
  source: string | null;
  verified_by: string | null;
}

interface PurchaseRow {
  id: string;
  quantity_item_id: string;
  qty: string;
  unit_price_lyd: string;
  supplier: string | null;
  purchased_on: string;
  expense_ref: string | null;
  created_at: string;
}

/** Supabase caps a response at 1,000 rows: a partial list would show wrong totals, so refuse it. */
function complete<T>(rows: T[] | null, count: number | null, what: string): T[] {
  const list = rows ?? [];
  if (count !== null && list.length < count) throw new Error(`${what} incomplete: got ${list.length} of ${count}`);
  return list;
}

export function supabaseQuantityStore(supabase: SupabaseClient): QuantityStore {
  return {
    async listItems(projectId) {
      // Quantities arrive as text ("::text"), never as JS numbers.
      const { data, error, count } = await supabase
        .from('quantity_items')
        .select('id, material, unit, planned_qty::text, waste_pct::text, phase_id, source, verified_by', { count: 'exact' })
        .eq('project_id', projectId)
        .returns<ItemRow[]>();
      if (error) throw new Error(`quantity items unavailable: ${error.message}`);
      return complete(data, count, 'quantity items').map(
        (r): ItemRecord => ({
          id: r.id,
          material: r.material,
          unit: r.unit,
          plannedQty: r.planned_qty,
          wastePct: r.waste_pct,
          phaseId: r.phase_id,
          source: r.source,
          verifiedBy: r.verified_by,
        }),
      );
    },

    async listPurchases(projectId) {
      const { data, error, count } = await supabase
        .from('purchases')
        .select('id, quantity_item_id, qty::text, unit_price_lyd::text, supplier, purchased_on, expense_ref, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .returns<PurchaseRow[]>();
      if (error) throw new Error(`purchases unavailable: ${error.message}`);
      return complete(data, count, 'purchases').map(
        (r): PurchaseRecord => ({
          id: r.id,
          itemId: r.quantity_item_id,
          qty: r.qty,
          unitPriceLyd: r.unit_price_lyd,
          supplier: r.supplier,
          purchasedOn: r.purchased_on,
          expenseRef: r.expense_ref,
          createdAt: r.created_at,
        }),
      );
    },

    async addItem(projectId, item) {
      const { data, error } = await supabase
        .from('quantity_items')
        .insert({
          project_id: projectId,
          material: item.material,
          unit: item.unit,
          planned_qty: item.plannedQty, // decimal strings; PostgreSQL reads them as numeric
          waste_pct: item.wastePct,
          phase_id: item.phaseId,
          source: item.source,
          verified_by: item.verifiedBy,
        })
        .select('id')
        .single();
      if (error) return { status: 'failed', reason: mapQuantityError(error) };
      return { status: 'done', id: (data as { id: string }).id };
    },

    async deleteItem(projectId, itemId) {
      const { data, error } = await supabase.from('quantity_items').delete().eq('project_id', projectId).eq('id', itemId).select('id');
      if (error) return { status: 'failed', reason: mapQuantityError(error) };
      // RLS hides another project's line: 0 rows = not found (nothing tells a stranger it exists).
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },

    async recordPurchase(p) {
      // One database function = one transaction: the purchase and its purchase.recorded event (0024).
      const { data, error } = await supabase.rpc('record_purchase', {
        p_project_id: p.projectId,
        p_quantity_item_id: p.itemId,
        p_qty: p.qty,
        p_unit_price_lyd: p.unitPriceLyd,
        p_client_op_id: p.clientOpId,
        p_supplier: p.supplier,
        p_purchased_on: p.purchasedOn,
        p_over_allowance_confirmed: p.overAllowanceConfirmed,
      });
      if (error) return { status: 'failed', reason: mapQuantityError(error) };
      const row = (Array.isArray(data) ? data[0] : data) as { purchase_id?: unknown; created?: unknown } | null;
      if (!row || typeof row.purchase_id !== 'string') return { status: 'failed', reason: 'unavailable' };
      return { status: 'done', purchaseId: row.purchase_id, created: row.created === true };
    },

    async linkExpense(projectId, purchaseId, expenseId) {
      const { data, error } = await supabase
        .from('purchases')
        .update({ expense_ref: expenseId })
        .eq('project_id', projectId)
        .eq('id', purchaseId)
        .select('id');
      if (error) return { status: 'failed', reason: mapQuantityError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },
  };
}
