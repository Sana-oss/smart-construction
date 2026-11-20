import type { SupabaseClient } from '@supabase/supabase-js';
import { toDb } from '@/shared-kernel';
import type { ChecklistFailure, ChecklistItemRecord, ChecklistRecord, ChecklistStore, TemplateRecord } from '../application/checklists';
import type { CheckResult } from '../domain/checklist';

// Supabase adapter for checklists (0025). Always used with the signed-in user's client, so RLS decides (0001: members
// read, writers write). Reads and writes only the quality module's own tables.

/** PostgreSQL error codes -> our reasons, so a raw database message never reaches the owner (NFR-USE-04). */
export function mapChecklistError(error: { code?: string }): ChecklistFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503': // create_checklist: the phase or the template is not this project's / unknown
      return 'unknown_reference';
    case '23505': // the same photo on two items (0026)
    case '23514':
    case '23502':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface TemplateRow {
  id: string;
  kind: 'hold_point' | 'readiness' | 'safe_stop';
  title: string;
  items: unknown[];
  status: 'unreviewed' | 'approved';
  source: string;
}
interface ChecklistRow {
  id: string;
  kind: 'hold_point' | 'readiness' | 'safe_stop';
  phase_id: string | null;
  title: string;
  status: 'open' | 'completed';
  template_status: 'unreviewed' | 'approved';
  created_at: string;
}
interface ItemRow {
  id: string;
  checklist_id: string;
  position: number;
  text: string;
  requires_photo: boolean;
  result: CheckResult | null;
  note: string | null;
  responsible: string | null;
  recheck_on: string | null;
  checked_at: string | null;
  photo_path: string | null;
  takes_cost: boolean;
  cost_lyd: string | null;
}

/** Supabase caps a response at 1,000 rows: a partial list would show a wrong progress, so refuse it. */
function complete<T>(rows: T[] | null, count: number | null, what: string): T[] {
  const list = rows ?? [];
  if (count !== null && list.length < count) throw new Error(`${what} incomplete: got ${list.length} of ${count}`);
  return list;
}

export function supabaseChecklistStore(supabase: SupabaseClient): ChecklistStore {
  return {
    async listTemplates() {
      const { data, error } = await supabase.from('checklist_templates').select('id, kind, title, items, status, source').returns<TemplateRow[]>();
      if (error) throw new Error(`checklist templates unavailable: ${error.message}`);
      return (data ?? []).map((r): TemplateRecord => ({ id: r.id, kind: r.kind, title: r.title, itemCount: r.items.length, status: r.status, source: r.source }));
    },

    async listChecklists(projectId) {
      const { data, error, count } = await supabase
        .from('checklists')
        .select('id, kind, phase_id, title, status, template_status, created_at', { count: 'exact' })
        .eq('project_id', projectId)
        .in('kind', ['hold_point', 'readiness', 'safe_stop'])
        .returns<ChecklistRow[]>();
      if (error) throw new Error(`checklists unavailable: ${error.message}`);
      return complete(data, count, 'checklists').map(
        (r): ChecklistRecord => ({
          id: r.id,
          kind: r.kind,
          phaseId: r.phase_id,
          title: r.title,
          status: r.status,
          templateStatus: r.template_status,
          createdAt: r.created_at,
        }),
      );
    },

    async listItems(projectId) {
      // checklist_items has no project_id (0001): filtered through its checklist.
      const { data, error, count } = await supabase
        .from('checklist_items')
        .select('id, checklist_id, position, text, requires_photo, result, note, responsible, recheck_on, checked_at, photo_path, takes_cost, cost_lyd::text, checklists!inner(project_id, kind)', {
          count: 'exact',
        })
        .eq('checklists.project_id', projectId)
        .in('checklists.kind', ['hold_point', 'readiness', 'safe_stop'])
        .returns<ItemRow[]>();
      if (error) throw new Error(`checklist items unavailable: ${error.message}`);
      return complete(data, count, 'checklist items').map(
        (r): ChecklistItemRecord => ({
          id: r.id,
          checklistId: r.checklist_id,
          position: r.position,
          text: r.text,
          requiresPhoto: r.requires_photo,
          result: r.result,
          note: r.note,
          responsible: r.responsible,
          recheckOn: r.recheck_on,
          checkedAt: r.checked_at,
          photoPath: r.photo_path,
          takesCost: r.takes_cost,
          costLyd: r.cost_lyd,
        }),
      );
    },

    async createChecklist(c) {
      const { data, error } = await supabase.rpc('create_checklist', {
        p_project_id: c.projectId,
        p_phase_id: c.phaseId,
        p_title: c.title,
        p_template_id: c.templateId,
      });
      if (error) return { status: 'failed', reason: mapChecklistError(error) };
      return typeof data === 'string' ? { status: 'done', id: data } : { status: 'failed', reason: 'unavailable' };
    },

    async createStopPlan(projectId, phaseId) {
      const { data, error } = await supabase.rpc('create_stop_plan', { p_project_id: projectId, p_phase_id: phaseId });
      if (error) return { status: 'failed', reason: mapChecklistError(error) };
      return typeof data === 'string' ? { status: 'done', id: data } : { status: 'failed', reason: 'unavailable' };
    },

    async createReadiness(projectId) {
      const { data, error } = await supabase.rpc('create_readiness_checklist', { p_project_id: projectId });
      if (error) return { status: 'failed', reason: mapChecklistError(error) };
      return typeof data === 'string' ? { status: 'done', id: data } : { status: 'failed', reason: 'unavailable' };
    },

    async recordCheck(itemId, check) {
      // Who checked and when are set by the database (0025), never sent from here.
      const { data, error } = await supabase
        .from('checklist_items')
        .update({ result: check.result, note: check.note, responsible: check.responsible, recheck_on: check.recheckOn, photo_path: check.photoPath, cost_lyd: check.costLyd === null ? null : toDb(check.costLyd) })
        .eq('id', itemId)
        .select('id');
      if (error) return { status: 'failed', reason: mapChecklistError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },
  };
}
