// Saving and editing a contract, called by the Server Action in src/app/contracts (it checks the contract copy, a document, which is
// another module's table). Server-only: uses the signed-in user's session (RLS applies).

import { createServerSupabase } from '@/platform/supabase/server';
import { addContract, updateContract, type AddContractResult, type UpdateContractResult } from '../application/contracts';
import type { ContractInput } from '../domain/contracts';
import { supabaseContractStore } from '../infra/supabase-contract-store';

export async function saveContract(command: ContractInput & { projectId: string }): Promise<AddContractResult> {
  return addContract(supabaseContractStore(await createServerSupabase()), command);
}

/** Edit a contract (3.16 deepening), called by the Server Action in src/app/contracts that checks the contract copy. */
export async function changeContract(command: ContractInput & { projectId: string; id: string }): Promise<UpdateContractResult> {
  return updateContract(supabaseContractStore(await createServerSupabase()), command);
}
