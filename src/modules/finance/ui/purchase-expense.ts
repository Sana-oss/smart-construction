// Server-only: finance's handler for purchase.recorded, with the signed-in user's client (RLS applies). Called by the app
// right after a purchase is saved (owner's decision of 20 Nov 2026); the event worker (3.21) will call the same handler.

import type { PurchaseRecordedPayload } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import { handlePurchaseRecorded, type PurchaseExpenseResult } from '../application/on-purchase-recorded';
import { supabaseExpenseGateway } from '../infra/supabase-expense-gateway';

export async function recordPurchaseExpense(projectId: string, event: PurchaseRecordedPayload): Promise<PurchaseExpenseResult> {
  return handlePurchaseRecorded(supabaseExpenseGateway(await createServerSupabase()), projectId, event);
}
