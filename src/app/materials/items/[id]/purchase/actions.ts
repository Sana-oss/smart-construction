'use server';

// Recording a purchase (design S21.1; FR-MAT-02, FR-FIN-03). In the app layer because it uses two L2 modules, which may
// not import each other (rule R2): materials saves the purchase and its purchase.recorded event (one transaction,
// 0024), then the app hands the event to finance at once (owner's decision of 20 Nov 2026), which makes ONE expense
// keyed on the purchase id. If that step fails, the purchase stays and its line offers «تسجيل المصروف»: running the
// handler again finds the same expense or makes the missing one, never a second one. The event worker (3.21) will do
// the same for events nobody handled.

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { formatAmount, type PurchaseRecordedPayload } from '@/shared-kernel';
import { recordPurchaseExpense } from '@/modules/finance';
import {
  getPendingPurchaseEvent,
  itemPath,
  linkPurchaseExpense,
  MATERIALS_PATH,
  qtyErrorsAr,
  qtyFailedAr,
  qtyTextAr,
  recordProjectPurchase,
  type PurchaseFormState,
} from '@/modules/materials';
import { getMyProject } from '@/modules/projects';

const FIELDS = ['qty', 'unitPrice', 'supplier', 'purchasedOn', 'clientOpId'] as const;

/** Finance makes the expense, then materials keeps its id. false = the expense is still missing (offer to finish). */
async function dispatchPurchaseRecorded(projectId: string, event: PurchaseRecordedPayload): Promise<boolean> {
  const expense = await recordPurchaseExpense(projectId, event);
  if (!expense.ok) return false;
  return linkPurchaseExpense(projectId, event.purchaseId, expense.expenseId);
}

export async function recordPurchaseAction(itemId: string, unit: string, _prev: PurchaseFormState, form: FormData): Promise<PurchaseFormState> {
  const values = Object.fromEntries(FIELDS.map((k) => [k, String(form.get(k) ?? '')])) as Record<(typeof FIELDS)[number], string>;
  const project = await getMyProject();
  if (!project) return { formError: qtyFailedAr.no_project, values };

  const result = await recordProjectPurchase(project.id, itemId, { ...values, overAllowanceConfirmed: form.get('overConfirmed') === 'yes' });
  if (!result.ok) {
    if (result.kind === 'failed') return { formError: qtyFailedAr[result.reason], values };
    if (result.kind === 'needs_confirmation') {
      return {
        overWarning: qtyTextAr.purchaseForm.overWarning(formatAmount(result.afterQty), formatAmount(result.allowedQty), formatAmount(result.overBy), unit),
        values,
      };
    }
    const fieldErrors: PurchaseFormState['fieldErrors'] = {};
    for (const e of result.errors) fieldErrors[e.field] ??= qtyErrorsAr[e.code as keyof typeof qtyErrorsAr];
    return { fieldErrors, values };
  }

  const linked = await dispatchPurchaseRecorded(project.id, result.event);
  revalidatePath('/', 'layout');
  redirect(`${itemPath(itemId)}?done=${linked ? 'purchased' : 'expense_pending'}`);
}

/** Bound to one purchase whose expense is missing. Safe to run twice: the expense is keyed on the purchase id. */
export async function finishPurchaseExpenseAction(itemId: string, purchaseId: string): Promise<void> {
  const project = await getMyProject();
  if (!project) redirect(MATERIALS_PATH);
  const event = await getPendingPurchaseEvent(project.id, purchaseId);
  const linked = event === null ? true : await dispatchPurchaseRecorded(project.id, event);
  revalidatePath('/', 'layout');
  redirect(`${itemPath(itemId)}?done=${linked ? 'expense_finished' : 'expense_pending'}`);
}
