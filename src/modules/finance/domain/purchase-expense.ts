import Decimal from 'decimal.js';
import { money, toDb, type PurchaseRecordedPayload } from '@/shared-kernel';
import type { NewExpenseInput } from './expense';

// FR-FIN-03: a material purchase becomes ONE expense of qty × unit price. Pure: no database. Finance does not know the
// purchases table: it only reads the purchase.recorded event (architecture §4.3).

/**
 * The expense a purchase makes. Its clientOpId IS the purchase id, so handling the same event twice (a retry, or the
 * future event worker, 3.21) finds the first expense and never makes a second one.
 */
export function expenseFromPurchase(event: PurchaseRecordedPayload): NewExpenseInput {
  const amount = money(new Decimal(event.qty).times(new Decimal(event.unitPriceLyd)));
  return {
    title: event.material,
    amount: toDb(amount),
    expenseType: 'materials',
    phaseId: event.phaseId,
    payee: event.supplier,
    paidOn: event.purchasedOn,
    clientOpId: event.purchaseId,
  };
}
