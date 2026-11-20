import type { PurchaseRecordedPayload } from '@/shared-kernel';
import { expenseFromPurchase } from '../domain/purchase-expense';
import { createExpense } from './create-expense';
import type { ExpenseFailure, ExpenseGateway } from './expense-gateway';

// Event handler: purchase.recorded -> one expense (FR-FIN-03; architecture §6). Idempotent: the expense's client_op_id is
// the purchase id, so a second delivery of the same event returns the first expense (duplicate = true).
// Today the app calls it right after the purchase is saved (owner's decision of 20 Nov 2026); the event worker (3.21)
// will call the same function for events that were not handled.

export type PurchaseExpenseResult =
  | { ok: true; expenseId: string; duplicate: boolean }
  | { ok: false; reason: ExpenseFailure | 'invalid' };

export async function handlePurchaseRecorded(
  gateway: ExpenseGateway,
  projectId: string,
  event: PurchaseRecordedPayload,
  now: Date = new Date(),
): Promise<PurchaseExpenseResult> {
  const r = await createExpense(gateway, { ...expenseFromPurchase(event), projectId }, now);
  if (r.ok) return { ok: true, expenseId: r.saved.expenseId, duplicate: r.duplicate };
  return { ok: false, reason: r.kind === 'invalid' ? 'invalid' : r.reason };
}
