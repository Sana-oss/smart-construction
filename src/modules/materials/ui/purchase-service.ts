// Server-only calls the app uses to record a purchase and link its expense (design S21.1; FR-MAT-02, FR-FIN-03).
// The app layer composes them with finance's handler, because only the app may use two L2 modules (rule R2).
// Not a 'use server' file: these are called from the app's own Server Action, never from the browser directly.

import { todayInTripoli, type PurchaseRecordedPayload } from '@/shared-kernel';
import { createServerSupabase } from '@/platform/supabase/server';
import { pendingPurchaseEvent, recordPurchase, type PurchaseCommand, type RecordPurchaseResult } from '../application/quantities';
import { supabaseQuantityStore } from '../infra/supabase-quantity-store';

/** Records the purchase and its purchase.recorded event (one transaction, 0024). */
export async function recordProjectPurchase(projectId: string, itemId: string, command: PurchaseCommand): Promise<RecordPurchaseResult> {
  return recordPurchase(supabaseQuantityStore(await createServerSupabase()), projectId, itemId, command, todayInTripoli());
}

/** Sets the purchase's weak reference to the expense finance made. */
export async function linkPurchaseExpense(projectId: string, purchaseId: string, expenseId: string): Promise<boolean> {
  const r = await supabaseQuantityStore(await createServerSupabase()).linkExpense(projectId, purchaseId, expenseId);
  return r.status === 'done';
}

/** The event of a purchase whose expense is still missing, or null (see application/quantities.ts). */
export async function getPendingPurchaseEvent(projectId: string, purchaseId: string): Promise<PurchaseRecordedPayload | null> {
  return pendingPurchaseEvent(supabaseQuantityStore(await createServerSupabase()), projectId, purchaseId);
}
