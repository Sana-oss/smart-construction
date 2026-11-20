// Event types exchanged through the outbox (architecture section 6).
// Consumers MUST be idempotent: the same event may be delivered more than once.
export const EVENT_TYPES = [
  'expense.created',
  'expense.updated', // 0016: payload has amount_lyd and previous_amount_lyd (text)
  'expense.deleted', // 0016: the audit log keeps the deleted values
  'purchase.recorded',
  'phase.status_changed',
  'phase.closing_requested',
  'phase.closed',
  'checklist.completed',
  'issue.opened',
  'stock.counted',
  'stock.over_allowance',
  'quote.expiring',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export interface DomainEvent<P = Record<string, unknown>> {
  id: string;
  type: EventType;
  projectId: string;
  payload: P;
  createdAt: string; // ISO timestamp
}

/**
 * purchase.recorded (0024): written by materials with the purchase, in one transaction. Finance turns it into ONE
 * expense of qty × unit price (FR-FIN-03). Numbers are canonical decimal strings, never JS numbers.
 */
export interface PurchaseRecordedPayload {
  purchaseId: string;
  material: string;
  unit: string;
  phaseId: string | null;
  /** "3", "12.5" */
  qty: string;
  /** "4000.000" */
  unitPriceLyd: string;
  supplier: string | null;
  /** "YYYY-MM-DD" */
  purchasedOn: string;
}
