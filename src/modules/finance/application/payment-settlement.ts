import type { FileStore } from '@/platform/supabase/storage';
import { isUuid, money } from '@/shared-kernel';
import {
  decidePayment,
  decideRelease,
  expenseFromPayment,
  expenseFromRelease,
  type DueGap,
  type DueState,
  type PayError,
  type PayInput,
  type ReleaseInput,
} from '../domain/payments';
import { deleteExpense } from './change-expense';
import type { ContractRecord, ContractStore, PaymentRecord, StoreOutcome } from './contracts';
import { createExpense } from './create-expense';
import type { ExpenseEditor, ExpenseFailure, ExpenseGateway } from './expense-gateway';

// Use cases: paying an installment, undoing it, releasing the retained part, undoing the release (FR-FIN-09, UC-16; 3.16
// contractual part, slice 2; owner's decisions of 21 Nov 2026). Run on the server as the signed-in user, under RLS.
// A payment makes ONE expense (amount minus the retained part), keyed by the payment id; the release makes a second one,
// keyed by the payment's release_op_id. The expense is made FIRST (idempotent), then the payment is marked: if the second
// step fails, a retry finds the same expense and never makes another (same pattern as a purchase, 0024).

export type SettleFailure = ExpenseFailure | 'already_paid' | 'not_paid' | 'already_released' | 'nothing_retained' | 'not_released';

/** Port: the writes that mark a payment paid or released. The Supabase adapter is infra/supabase-settlement-store.ts. */
export interface SettlementStore {
  /** Pays: one transaction updates the payment and, when `gaps` is given, logs the confirmed warning (D2). */
  markPaid(c: { paymentId: string; paidOn: string; expenseId: string | null; gaps: readonly DueGap[] | null }): Promise<StoreOutcome>;
  /** Undo: the payment becomes unpaid again (its expense was deleted first). */
  markUnpaid(projectId: string, paymentId: string): Promise<StoreOutcome>;
  release(c: { paymentId: string; releasedOn: string; expenseId: string; early: boolean }): Promise<StoreOutcome>;
  undoRelease(projectId: string, paymentId: string): Promise<StoreOutcome>;
}

export interface SettlementDeps {
  contracts: ContractStore;
  settlement: SettlementStore;
  expenses: ExpenseGateway;
  editor: ExpenseEditor;
  files: FileStore;
}

async function findPayment(
  contracts: ContractStore,
  projectId: string,
  paymentId: string,
): Promise<{ payment: PaymentRecord; contract: ContractRecord } | null> {
  if (!isUuid(projectId) || !isUuid(paymentId)) return null;
  const [list, payments] = await Promise.all([contracts.listContracts(projectId), contracts.listPayments(projectId)]);
  const payment = payments.find((p) => p.id === paymentId.toLowerCase());
  const contract = payment && list.find((c) => c.id === payment.contractId);
  return payment && contract ? { payment, contract } : null;
}

export type PayResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: PayError[] }
  /** The payment is not due and the owner has not confirmed: show what is missing and ask (D2). */
  | { ok: false; kind: 'needs_confirm'; gaps: readonly DueGap[] }
  | { ok: false; kind: 'failed'; reason: SettleFailure };

/** @param due computed by the app from the phase and its photos (they belong to other modules). @param today the date in Libya. */
export async function payInstallment(
  deps: SettlementDeps,
  command: PayInput & { projectId: string; paymentId: string },
  due: DueState,
  today: string,
): Promise<PayResult> {
  const found = await findPayment(deps.contracts, command.projectId, command.paymentId);
  if (!found) return { ok: false, kind: 'failed', reason: 'not_found' };
  const { payment, contract } = found;
  if (payment.paidOn !== null) return { ok: false, kind: 'failed', reason: 'already_paid' };

  const decision = decidePayment(command, due, today);
  if (!decision.ok) return decision;

  let expenseId: string | null = null;
  const expense = expenseFromPayment({
    paymentId: payment.id,
    contractTitle: contract.title,
    paymentTitle: payment.title,
    contractor: contract.contractor,
    phaseId: payment.phaseId,
    amountLyd: payment.amountLyd,
    retainedLyd: payment.retainedLyd,
    paidOn: decision.paidOn,
    expenseType: decision.expenseType,
  });
  if (expense) {
    const made = await createExpense(deps.expenses, { ...expense, projectId: command.projectId });
    if (!made.ok) return { ok: false, kind: 'failed', reason: made.kind === 'invalid' ? 'rejected' : made.reason };
    expenseId = made.saved.expenseId;
  }
  const marked = await deps.settlement.markPaid({ paymentId: payment.id, paidOn: decision.paidOn, expenseId, gaps: decision.confirmedGaps });
  return marked.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: marked.reason };
}

export type ReleaseResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: PayError[] }
  | { ok: false; kind: 'needs_confirm' }
  | { ok: false; kind: 'failed'; reason: SettleFailure };

/** @param allPhasesDone from the project's phases (the app reads them); false asks for a confirmation (D2). */
export async function releaseRetained(
  deps: SettlementDeps,
  command: ReleaseInput & { projectId: string; paymentId: string },
  ctx: { allPhasesDone: boolean },
  today: string,
): Promise<ReleaseResult> {
  const found = await findPayment(deps.contracts, command.projectId, command.paymentId);
  if (!found) return { ok: false, kind: 'failed', reason: 'not_found' };
  const { payment, contract } = found;
  if (payment.paidOn === null) return { ok: false, kind: 'failed', reason: 'not_paid' };
  if (payment.releasedOn !== null) return { ok: false, kind: 'failed', reason: 'already_released' };
  if (!money(payment.retainedLyd).gt(0)) return { ok: false, kind: 'failed', reason: 'nothing_retained' };

  const decision = decideRelease(command, { today, paidOn: payment.paidOn, allPhasesDone: ctx.allPhasesDone });
  if (!decision.ok) return decision;

  const made = await createExpense(deps.expenses, {
    ...expenseFromRelease({
      releaseOpId: payment.releaseOpId,
      contractTitle: contract.title,
      paymentTitle: payment.title,
      contractor: contract.contractor,
      phaseId: payment.phaseId,
      retainedLyd: payment.retainedLyd,
      releasedOn: decision.releasedOn,
      expenseType: decision.expenseType,
    }),
    projectId: command.projectId,
  });
  if (!made.ok) return { ok: false, kind: 'failed', reason: made.kind === 'invalid' ? 'rejected' : made.reason };
  const marked = await deps.settlement.release({ paymentId: payment.id, releasedOn: decision.releasedOn, expenseId: made.saved.expenseId, early: decision.confirmedEarly });
  return marked.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: marked.reason };
}

export type UndoResult = { ok: true } | { ok: false; reason: SettleFailure };

/** The owner recorded a payment by mistake: its expense is deleted and the payment is unpaid again. Both stay in the audit log. */
export async function undoPayment(deps: SettlementDeps, command: { projectId: string; paymentId: string }): Promise<UndoResult> {
  const found = await findPayment(deps.contracts, command.projectId, command.paymentId);
  if (!found) return { ok: false, reason: 'not_found' };
  const { payment } = found;
  if (payment.paidOn === null) return { ok: false, reason: 'not_paid' };
  // The database refuses it too: the release is undone before the payment.
  if (payment.releasedOn !== null) return { ok: false, reason: 'already_released' };
  if (payment.expenseId !== null) {
    const removed = await deleteExpense(deps.editor, { projectId: command.projectId, expenseId: payment.expenseId }, deps.files);
    if (!removed.ok && removed.reason !== 'not_found') return { ok: false, reason: removed.reason };
  }
  const marked = await deps.settlement.markUnpaid(command.projectId.toLowerCase(), payment.id);
  return marked.status === 'done' ? { ok: true } : { ok: false, reason: marked.reason };
}

export async function undoRelease(deps: SettlementDeps, command: { projectId: string; paymentId: string }): Promise<UndoResult> {
  const found = await findPayment(deps.contracts, command.projectId, command.paymentId);
  if (!found) return { ok: false, reason: 'not_found' };
  const { payment } = found;
  if (payment.releasedOn === null) return { ok: false, reason: 'not_released' };
  if (payment.releaseExpenseId !== null) {
    const removed = await deleteExpense(deps.editor, { projectId: command.projectId, expenseId: payment.releaseExpenseId }, deps.files);
    if (!removed.ok && removed.reason !== 'not_found') return { ok: false, reason: removed.reason };
  }
  const marked = await deps.settlement.undoRelease(command.projectId.toLowerCase(), payment.id);
  return marked.status === 'done' ? { ok: true } : { ok: false, reason: marked.reason };
}
