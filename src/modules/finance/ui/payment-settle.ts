// Paying and releasing an installment, called by the Server Actions in src/app/contracts (they compute the due state and
// «all phases done» from projects and documents, which finance may not import). Server-only: uses the signed-in user's
// session (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { supabaseFileStore } from '@/platform/supabase/storage';
import { payInstallment, releaseRetained, undoPayment, undoRelease, type SettlementDeps } from '../application/payment-settlement';
import { supabaseContractStore } from '../infra/supabase-contract-store';
import { supabaseExpenseEditor, supabaseExpenseGateway } from '../infra/supabase-expense-gateway';
import { supabaseSettlementStore } from '../infra/supabase-settlement-store';

async function deps(): Promise<SettlementDeps> {
  const supabase = await createServerSupabase();
  return {
    contracts: supabaseContractStore(supabase),
    settlement: supabaseSettlementStore(supabase),
    expenses: supabaseExpenseGateway(supabase),
    editor: supabaseExpenseEditor(supabase),
    files: supabaseFileStore(supabase),
  };
}

export async function payPayment(...args: Parameters<typeof payInstallment> extends [unknown, ...infer R] ? R : never) {
  return payInstallment(await deps(), ...args);
}
export async function releasePayment(...args: Parameters<typeof releaseRetained> extends [unknown, ...infer R] ? R : never) {
  return releaseRetained(await deps(), ...args);
}
export async function undoPaymentPaid(...args: Parameters<typeof undoPayment> extends [unknown, ...infer R] ? R : never) {
  return undoPayment(await deps(), ...args);
}
export async function undoPaymentRelease(...args: Parameters<typeof undoRelease> extends [unknown, ...infer R] ? R : never) {
  return undoRelease(await deps(), ...args);
}
