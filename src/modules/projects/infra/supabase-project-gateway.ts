import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhaseStatus } from '../domain/phase-plan';
import type { ProjectType } from '../domain/project-setup';
import type { MyProject, ProjectGateway, TemplatePhase } from '../application/project-gateway';

// Supabase adapter for the projects module. Always used with the signed-in user's client: RLS decides what is visible.
// Money columns come back from PostgREST as numbers or strings depending on size; they are turned into strings here
// and only ever handled as Decimal in the domain.

const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const strOrNull = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));

export function supabaseProjectGateway(supabase: SupabaseClient): ProjectGateway {
  return {
    async phaseTemplate(): Promise<TemplatePhase[]> {
      const { data, error } = await supabase
        .from('phase_templates')
        .select('position, name, description, status')
        .order('position');
      if (error) throw new Error(`phase template unavailable: ${error.message}`);
      return (data ?? []).map((r) => ({
        position: Number(r.position),
        name: String(r.name),
        description: r.description === null ? null : String(r.description),
        status: r.status === 'approved' ? 'approved' : 'unreviewed',
      }));
    },

    async myProject(): Promise<MyProject | null> {
      const { data: auth } = await supabase.auth.getClaims();
      const owner = auth?.claims?.sub;
      if (!owner) return null;
      const { data, error } = await supabase
        .from('projects')
        .select(
          'id, name, city, project_type, building_area_m2, total_budget_lyd, spent_before_lyd, contingency_pct, available_now_lyd, available_as_of, phases(position, name, status)',
        )
        .eq('owner_id', owner)
        .eq('status', 'active')
        .order('created_at')
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`project unavailable: ${error.message}`);
      if (!data) return null;
      return {
        id: String(data.id),
        name: String(data.name),
        city: strOrNull(data.city),
        projectType: data.project_type as ProjectType,
        buildingAreaM2: strOrNull(data.building_area_m2),
        totalBudgetLyd: str(data.total_budget_lyd),
        spentBeforeLyd: str(data.spent_before_lyd),
        contingencyPct: str(data.contingency_pct),
        availableNowLyd: strOrNull(data.available_now_lyd),
        availableAsOf: strOrNull(data.available_as_of),
        phases: ((data.phases ?? []) as { position: number; name: string; status: PhaseStatus }[])
          .map((p) => ({ position: Number(p.position), name: String(p.name), status: p.status }))
          .sort((a, b) => a.position - b.position),
      };
    },

    async createFirstProject(p) {
      // One database function = one transaction: project, phases and the audit row are saved together (0006).
      const { data, error } = await supabase.rpc('create_first_project', {
        p_name: p.name,
        p_city: p.city,
        p_project_type: p.projectType,
        p_building_area_m2: p.buildingAreaM2,
        p_total_budget_lyd: p.totalBudgetLyd,
        p_available_now_lyd: p.availableNowLyd,
        p_spent_before_lyd: p.spentBeforeLyd,
        p_contingency_pct: p.contingencyPct,
        p_phases: p.phases,
        p_over_budget_confirmed: p.overBudgetConfirmed,
      });
      if (error) {
        if (error.code === '23505') return { status: 'failed', reason: 'already_has_project' };
        if (error.code === '42501') return { status: 'failed', reason: 'not_signed_in' };
        return { status: 'failed', reason: 'unavailable' };
      }
      return { status: 'created', projectId: String(data) };
    },
  };
}
