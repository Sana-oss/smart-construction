// Event types exchanged through the outbox (architecture section 6).
// Consumers MUST be idempotent: the same event may be delivered more than once.
export const EVENT_TYPES = [
  'expense.created',
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
