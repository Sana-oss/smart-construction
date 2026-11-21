import { paidAmount } from './payments';
import { addMoney, isUuid, money, readMoneyInput, subMoney, type Money, type MoneyInput, type MoneyInputError } from '@/shared-kernel';

// Contracts and the payment schedule (FR-FIN-08, FR-FIN-09, UC-16; 3.16 contractual part, slice 1; owner's decisions of
// 21 Nov 2026, change register). Pure: no React, no database. Money is Decimal.
//   - A contract: contractor, title, value, scope, and an optional cleanup clause (FR-FIN-12). The value is positive.
//   - A payment is one installment of the schedule: a title, an amount, an optional phase (the stage it falls due after),
//     and an optional retained part that the owner types (D9: the percentage is left to the owner and the contractor;
//     the system never suggests one).
//   - Warn, never block (D2): a schedule that adds up to more than the contract value is shown with a warning.

export const CONTRACT_TITLE_MIN = 2;
export const CONTRACT_TITLE_MAX = 80;
export const CONTRACTOR_MAX = 80;
export const CONTRACT_SCOPE_MAX = 300;
export const CLEANUP_CLAUSE_MAX = 200;
export const PAYMENT_TITLE_MIN = 2;
export const PAYMENT_TITLE_MAX = 80;

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

export type ContractField = 'title' | 'contractor' | 'value' | 'scope' | 'cleanupClause' | 'documentId';
export type PaymentField = 'title' | 'amount' | 'retained' | 'phaseId';
export type ContractErrorCode = MoneyInputError | 'too_short' | 'too_long' | 'invalid_id' | 'retained_exceeds_amount';
export interface ContractError {
  field: ContractField;
  code: ContractErrorCode;
}
export interface PaymentError {
  field: PaymentField;
  code: ContractErrorCode;
}

export interface ContractInput {
  title?: string | null;
  contractor?: string | null;
  value?: string | null;
  scope?: string | null;
  /** Who removes the debris and at whose cost (FR-FIN-12). Empty = not agreed. */
  cleanupClause?: string | null;
  /** The contract copy: a document of type «عقد», chosen in the app layer (documents is another module). */
  documentId?: string | null;
}

export interface NewContract {
  title: string;
  contractor: string;
  valueLyd: Money;
  scope: string | null;
  cleanupClause: string | null;
  documentId: string | null;
}

function text(
  raw: string | null | undefined,
  field: ContractField,
  min: number,
  max: number,
  errors: ContractError[],
): string {
  const v = clean(raw);
  if (v === '') errors.push({ field, code: 'required' });
  else if (length(v) < min) errors.push({ field, code: 'too_short' });
  else if (length(v) > max) errors.push({ field, code: 'too_long' });
  return v;
}

export function validateContract(input: ContractInput): { ok: true; value: NewContract } | { ok: false; errors: ContractError[] } {
  const errors: ContractError[] = [];
  const title = text(input.title, 'title', CONTRACT_TITLE_MIN, CONTRACT_TITLE_MAX, errors);
  const contractor = text(input.contractor, 'contractor', CONTRACT_TITLE_MIN, CONTRACTOR_MAX, errors);
  const value = readMoneyInput(input.value);
  if (!value.ok) errors.push({ field: 'value', code: value.code });

  const scope = clean(input.scope) || null;
  if (scope !== null && length(scope) > CONTRACT_SCOPE_MAX) errors.push({ field: 'scope', code: 'too_long' });
  const cleanupClause = clean(input.cleanupClause) || null;
  if (cleanupClause !== null && length(cleanupClause) > CLEANUP_CLAUSE_MAX) errors.push({ field: 'cleanupClause', code: 'too_long' });

  let documentId: string | null = null;
  const doc = clean(input.documentId).toLowerCase();
  if (doc !== '') {
    if (isUuid(doc)) documentId = doc;
    else errors.push({ field: 'documentId', code: 'invalid_id' });
  }

  if (errors.length > 0 || !value.ok) return { ok: false, errors };
  return { ok: true, value: { title, contractor, valueLyd: value.value, scope, cleanupClause, documentId } };
}

export interface PaymentInput {
  /** e.g. «الدفعة الأولى». */
  title?: string | null;
  amount?: string | null;
  /** The stage the payment falls due after (FR-FIN-09). Empty = not tied to a stage (e.g. «بداية الأعمال»). */
  phaseId?: string | null;
  /** The part held back until handover. Empty = nothing retained. */
  retained?: string | null;
}

export interface NewPayment {
  title: string;
  amountLyd: Money;
  phaseId: string | null;
  /** Zero when nothing is retained. */
  retainedLyd: Money;
}

export function validatePayment(input: PaymentInput): { ok: true; value: NewPayment } | { ok: false; errors: PaymentError[] } {
  const errors: PaymentError[] = [];
  const title = clean(input.title);
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if (length(title) < PAYMENT_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if (length(title) > PAYMENT_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  const amount = readMoneyInput(input.amount);
  if (!amount.ok) errors.push({ field: 'amount', code: amount.code });

  let phaseId: string | null = null;
  const phase = clean(input.phaseId).toLowerCase();
  if (phase !== '') {
    if (isUuid(phase)) phaseId = phase;
    else errors.push({ field: 'phaseId', code: 'invalid_id' });
  }

  let retained: Money = money('0');
  if (clean(input.retained) !== '') {
    const r = readMoneyInput(input.retained, { allowZero: true });
    if (!r.ok) errors.push({ field: 'retained', code: r.code });
    else {
      retained = r.value;
      if (amount.ok && r.value.gt(amount.value)) errors.push({ field: 'retained', code: 'retained_exceeds_amount' });
    }
  }

  if (errors.length > 0 || !amount.ok) return { ok: false, errors };
  return { ok: true, value: { title, amountLyd: amount.value, phaseId, retainedLyd: retained } };
}

export interface ContractSummary {
  /** The contract value. */
  value: Money;
  /** The sum of every installment in the schedule. */
  scheduled: Money;
  /** What the schedule does not cover yet (never below zero): «باقي الدفعات وفق جدول العقد». */
  unscheduled: Money;
  /** What the schedule adds beyond the contract value (zero while it fits). D2: a warning, never a block. */
  overScheduled: Money;
  /** The money already paid: a paid installment minus its retained part while that is still held. */
  paid: Money;
  /** The contract value minus what is paid (S17.2: «المتبقي»). */
  remaining: Money;
  /** The retained parts not released yet (held back until handover). */
  retained: Money;
  /** FR-FIN-08: the schedule adds up to more than the contract value. */
  scheduleExceedsValue: boolean;
}

/** FR-FIN-08: the figures of S17.2. A paid payment is one with a paid date; its retained part counts as paid once released. */
export function contractSummary(input: {
  value: MoneyInput;
  payments: readonly { amountLyd: MoneyInput; retainedLyd: MoneyInput; paidOn: string | null; releasedOn?: string | null }[];
}): ContractSummary {
  const value = money(input.value);
  const scheduled = addMoney('0', ...input.payments.map((p) => p.amountLyd));
  // Money that left the owner's hands: a paid payment minus the retained part still held (slice 2).
  const paid = addMoney('0', ...input.payments.map((p) => paidAmount({ ...p, releasedOn: p.releasedOn ?? null })));
  const gap = subMoney(value, scheduled);
  return {
    value,
    scheduled,
    unscheduled: gap.isNegative() ? money('0') : gap,
    overScheduled: gap.isNegative() ? gap.negated() : money('0'),
    paid,
    remaining: subMoney(value, paid),
    retained: addMoney('0', ...input.payments.filter((p) => (p.releasedOn ?? null) === null).map((p) => p.retainedLyd)),
    scheduleExceedsValue: gap.isNegative(),
  };
}
