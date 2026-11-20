import Decimal from 'decimal.js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CoefficientReader } from '../application/calculators';

// Reads the calculator coefficient (migration 0023) with the signed-in user's client: RLS lets signed-in users read it.
// The value arrives as text, never as a JS number, and becomes a Decimal.

interface CoefficientRow {
  value: string;
  status: 'unreviewed' | 'approved';
  source: string;
  reviewed_by: string | null;
  reviewed_on: string | null;
}

export function supabaseCoefficientReader(supabase: SupabaseClient): CoefficientReader {
  return {
    async rebarCoefficient() {
      const { data, error } = await supabase
        .from('calc_coefficients')
        .select('value::text, status, source, reviewed_by, reviewed_on')
        .eq('key', 'rebar_kg_per_m_divisor')
        .returns<CoefficientRow[]>()
        .maybeSingle();
      if (error) throw new Error(`coefficient unavailable: ${error.message}`);
      if (!data) return null;
      const row = data as CoefficientRow;
      return {
        divisor: new Decimal(row.value),
        status: row.status,
        source: row.source,
        reviewedBy: row.reviewed_by,
        reviewedOn: row.reviewed_on,
      };
    },
  };
}
