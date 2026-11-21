// Saving a contract, called by the Server Action in src/app/contracts (it checks the contract copy, a document, which is
// another module's table). Server-only: uses the signed-in user's session (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { addContract, type AddContractResult } from '../application/contracts';
import type { ContractInput } from '../domain/contracts';
import { supabaseContractStore } from '../infra/supabase-contract-store';

export async function saveContract(command: ContractInput & { projectId: string }): Promise<AddContractResult> {
  return addContract(supabaseContractStore(await createServerSupabase()), command);
}
