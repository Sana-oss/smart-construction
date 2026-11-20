import type { SupabaseClient } from '@supabase/supabase-js';
import type { IssueFailure, IssueRecord, IssueStore } from '../application/issues';

// Supabase adapter for the defects list (0029). Always used with the signed-in user's client, so RLS decides (0001:
// members read, writers write). Reads and writes only the quality module's own tables.

export function mapIssueError(error: { code?: string }): IssueFailure {
  switch (error.code) {
    case '42501':
      return 'not_allowed';
    case '23503':
      return 'unknown_reference';
    case '23505': // the same photo on two defects
    case '23514':
    case '23502':
    case '22007':
      return 'rejected';
    default:
      return 'unavailable';
  }
}

interface IssueRow {
  id: string;
  title: string;
  location: string | null;
  description: string | null;
  responsible: string | null;
  severity: IssueRecord['severity'];
  status: IssueRecord['status'];
  phase_id: string | null;
  checklist_id: string | null;
  due_on: string | null;
  photo_path: string | null;
  created_at: string;
  started_at: string | null;
  closed_at: string | null;
}

export function supabaseIssueStore(supabase: SupabaseClient): IssueStore {
  return {
    async list(projectId) {
      const { data, error, count } = await supabase
        .from('issues')
        .select('id, title, location, description, responsible, severity, status, phase_id, checklist_id, due_on, photo_path, created_at, started_at, closed_at', {
          count: 'exact',
        })
        .eq('project_id', projectId)
        .returns<IssueRow[]>();
      if (error) throw new Error(`issues unavailable: ${error.message}`);
      const rows = data ?? [];
      // Supabase caps a response at 1,000 rows: a partial list would hide open defects.
      if (count !== null && rows.length < count) throw new Error(`issues incomplete: got ${rows.length} of ${count}`);
      return rows.map(
        (r): IssueRecord => ({
          id: r.id,
          title: r.title,
          location: r.location,
          description: r.description,
          responsible: r.responsible,
          severity: r.severity,
          status: r.status,
          phaseId: r.phase_id,
          checklistId: r.checklist_id,
          dueOn: r.due_on,
          photoPath: r.photo_path,
          createdAt: r.created_at,
          startedAt: r.started_at,
          closedAt: r.closed_at,
        }),
      );
    },

    async checklistIds(projectId) {
      const { data, error } = await supabase.from('checklists').select('id').eq('project_id', projectId).returns<{ id: string }[]>();
      if (error) throw new Error(`checklists unavailable: ${error.message}`);
      return (data ?? []).map((r) => r.id);
    },

    async add(projectId, i) {
      const { data, error } = await supabase
        .from('issues')
        .insert({
          project_id: projectId,
          title: i.title,
          location: i.location,
          description: i.description,
          responsible: i.responsible,
          severity: i.severity,
          phase_id: i.phaseId,
          checklist_id: i.checklistId,
          due_on: i.dueOn,
          photo_path: i.photoPath,
        })
        .select('id')
        .single();
      if (error) return { status: 'failed', reason: mapIssueError(error) };
      return { status: 'done', id: (data as { id: string }).id };
    },

    async setStatus(projectId, id, status) {
      // The dates of the states are set by the database (0029), never sent from here.
      const { data, error } = await supabase.from('issues').update({ status }).eq('project_id', projectId).eq('id', id).select('id');
      if (error) return { status: 'failed', reason: mapIssueError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },

    async setPhoto(projectId, id, photoPath) {
      const { data, error } = await supabase.from('issues').update({ photo_path: photoPath }).eq('project_id', projectId).eq('id', id).select('id');
      if (error) return { status: 'failed', reason: mapIssueError(error) };
      return (data ?? []).length === 0 ? { status: 'failed', reason: 'not_found' } : { status: 'done' };
    },
  };
}
