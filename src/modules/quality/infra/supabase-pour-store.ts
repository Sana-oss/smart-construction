import type { SupabaseClient } from '@supabase/supabase-js';
import type { PourFailure, PourRecord, PourStore } from '../application/concrete';

// Supabase adapter for the concrete log (0002, 0030). Always used with the signed-in user's client, so RLS decides
// (members read, writers write). Reads and writes only the quality module's own table.

export function mapPourError(error: { code?: string }): PourFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23514':
    case '23502':
    case '22003':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface PourRow {
  id: string;
  location: string;
  poured_on: string;
  supplier: string;
  qty_m3: string;
  cube_samples: number;
  mix_ref: string | null;
  delivery_ref: string | null;
  phase_id: string | null;
  curing_until: string | null;
  formwork_on: string | null;
  curing_done_at: string | null;
  formwork_done_at: string | null;
  note: string | null;
  created_at: string;
}

const COLUMNS =
  'id, location, poured_on, supplier, qty_m3::text, cube_samples, mix_ref, delivery_ref, phase_id, curing_until, formwork_on, curing_done_at, formwork_done_at, note, created_at';

export function supabasePourStore(supabase: SupabaseClient): PourStore {
  return {
    async list(projectId) {
      const { data, error, count } = await supabase.from('concrete_pours').select(COLUMNS, { count: 'exact' }).eq('project_id', projectId).returns<PourRow[]>();
      if (error) throw new Error(`concrete pours unavailable: ${error.message}`);
      const rows = data ?? [];
      if (count !== null && rows.length < count) throw new Error(`concrete pours incomplete: got ${rows.length} of ${count}`);
      return rows.map(
        (r): PourRecord => ({
          id: r.id,
          element: r.location,
          pouredOn: r.poured_on,
          supplier: r.supplier,
          qtyM3: r.qty_m3,
          cubeSamples: r.cube_samples,
          mixRef: r.mix_ref,
          deliveryRef: r.delivery_ref,
          phaseId: r.phase_id,
          curingUntil: r.curing_until,
          formworkOn: r.formwork_on,
          curingDoneAt: r.curing_done_at,
          formworkDoneAt: r.formwork_done_at,
          note: r.note,
          createdAt: r.created_at,
        }),
      );
    },

    async add(projectId, p) {
      const { data, error } = await supabase
        .from('concrete_pours')
        .insert({
          project_id: projectId,
          location: p.element,
          poured_on: p.pouredOn,
          supplier: p.supplier,
          qty_m3: p.qtyM3, // a decimal string; PostgreSQL reads it as numeric
          cube_samples: p.cubeSamples,
          mix_ref: p.mixRef,
          delivery_ref: p.deliveryRef,
          phase_id: p.phaseId,
          curing_until: p.curingUntil,
          formwork_on: p.formworkOn,
          note: p.note,
          client_op_id: p.clientOpId,
        })
        .select('id')
        .single();
      if (!error) return { status: 'done', id: (data as { id: string }).id };
      // A resent form (same client_op_id, 0002's unique index): the pour stored the first time.
      if (error.code === '23505') {
        const { data: found } = await supabase
          .from('concrete_pours')
          .select('id')
          .eq('project_id', projectId)
          .eq('client_op_id', p.clientOpId)
          .maybeSingle();
        if (found) return { status: 'done', id: (found as { id: string }).id };
      }
      return { status: 'failed', reason: mapPourError(error) };
    },

    async setDone(projectId, id, kind, done) {
      // Any value marks it; the database stamps the moment (0030). null undoes it.
      const column = kind === 'curing' ? 'curing_done_at' : 'formwork_done_at';
      const { data, error } = await supabase
        .from('concrete_pours')
        .update({ [column]: done ? new Date().toISOString() : null })
        .eq('project_id', projectId)
        .eq('id', id)
        .select('id');
      if (error) return { status: 'failed', reason: mapPourError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },

    async remove(projectId, id) {
      const { data, error } = await supabase.from('concrete_pours').delete().eq('project_id', projectId).eq('id', id).select('id');
      if (error) return { status: 'failed', reason: mapPourError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },
  };
}
