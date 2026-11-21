import { isIsoDate, money, subMoney, type Money, type MoneyInput } from '@/shared-kernel';
import { EXPENSE_PAYEE_MAX, EXPENSE_TITLE_MAX, EXPENSE_TYPES, type ExpenseType, type NewExpenseInput } from './expense';

// Paying an installment of a contract (FR-FIN-09, UC-16; 3.16 contractual part, slice 2; owner's decisions of 21 Nov 2026,
// change register). Pure: no React, no database. Money is Decimal.
//   - An installment tied to a phase is DUE when the phase is «منجزة» and has at least one photo of it (FR-FIN-09:
//     «لا تُعلَّم الدفعة مستحقة قبل اعتماد المالك للمرحلة بصور»). One not tied to a phase has no condition.
//   - Paying one that is not due is allowed (decision D2: warn, never block): the form lists what is missing, the owner
//     confirms, and the confirmation is logged (payment_confirmed_before_due).
//   - Paying makes ONE expense of the amount minus the retained part (the retained part is held until handover). The
//     expense's client_op_id is the payment id, so a retry never makes a second one. Releasing the retained part makes a
//     second expense, keyed by the payment's own release_op_id.
//   - The retained part is typed by the owner (D9); releasing it is allowed at any time, with a warning (D2) while a
//     phase is not done.

export type DueGap = 'phase_not_done' | 'phase_without_photo';
export type DueState = { state: 'not_tied' } | { state: 'due' } | { state: 'waiting'; gaps: readonly DueGap[] };

/** FR-FIN-09: is the installment due? `phaseStatus` null = the phase was not found (treated as not done). */
export function paymentDue(input: { phaseId: string | null; phaseStatus: string | null; phasePhotoCount: number }): DueState {
  if (input.phaseId === null) return { state: 'not_tied' };
  const gaps: DueGap[] = [];
  if (input.phaseStatus !== 'done') gaps.push('phase_not_done');
  if (input.phasePhotoCount < 1) gaps.push('phase_without_photo');
  return gaps.length === 0 ? { state: 'due' } : { state: 'waiting', gaps };
}

export type PaymentStage = 'scheduled' | 'paid_retained_held' | 'paid';

interface PaymentFacts {
  amountLyd: MoneyInput;
  retainedLyd: MoneyInput;
  paidOn: string | null;
  releasedOn: string | null;
}

/** Where the installment is: not paid yet, paid with its retained part still held, or paid in full. */
export function paymentStage(p: PaymentFacts): PaymentStage {
  if (p.paidOn === null) return 'scheduled';
  return money(p.retainedLyd).gt(0) && p.releasedOn === null ? 'paid_retained_held' : 'paid';
}

/** The money that left the owner's hands: nothing before payment, then the amount minus the retained part still held. */
export function paidAmount(p: PaymentFacts): Money {
  if (p.paidOn === null) return money('0');
  return p.releasedOn === null ? subMoney(p.amountLyd, p.retainedLyd) : money(p.amountLyd);
}

/** What the owner transfers when the payment is confirmed (the retained part stays with the owner). */
export const cashNow = (p: { amountLyd: MoneyInput; retainedLyd: MoneyInput }): Money => subMoney(p.amountLyd, p.retainedLyd);

export type PayField = 'paidOn' | 'expenseType';
export type PayErrorCode = 'invalid_date' | 'date_in_future' | 'before_paid' | 'unknown_choice';
export interface PayError {
  field: PayField | 'releasedOn';
  code: PayErrorCode;
}

const clean = (s: string | null | undefined) => (s ?? '').trim();

export interface PayInput {
  /** Empty = today in Libya. */
  paidOn?: string | null;
  /** Empty = «يد عاملة» (owner's decision of 21 Nov 2026). */
  expenseType?: string | null;
  /** The owner ticked «أؤكد السداد» after seeing what is missing. */
  confirmed?: boolean;
}

export type PayDecision =
  | { ok: true; paidOn: string; expenseType: ExpenseType; /** What was missing and the owner confirmed; null when nothing was. */ confirmedGaps: readonly DueGap[] | null }
  | { ok: false; kind: 'invalid'; errors: PayError[] }
  /** Not due and not confirmed yet: show the gaps and ask (D2). */
  | { ok: false; kind: 'needs_confirm'; gaps: readonly DueGap[] };

/** @param today the date in Libya. */
export function decidePayment(input: PayInput, due: DueState, today: string): PayDecision {
  const errors: PayError[] = [];
  let paidOn = today;
  const date = clean(input.paidOn);
  if (date !== '') {
    if (!isIsoDate(date)) errors.push({ field: 'paidOn', code: 'invalid_date' });
    else if (date > today) errors.push({ field: 'paidOn', code: 'date_in_future' });
    else paidOn = date;
  }
  const typeRaw = clean(input.expenseType);
  const expenseType = typeRaw === '' ? 'labor' : (EXPENSE_TYPES as readonly string[]).includes(typeRaw) ? (typeRaw as ExpenseType) : null;
  if (expenseType === null) errors.push({ field: 'expenseType', code: 'unknown_choice' });
  if (errors.length > 0 || expenseType === null) return { ok: false, kind: 'invalid', errors };

  if (due.state === 'waiting') {
    if (input.confirmed !== true) return { ok: false, kind: 'needs_confirm', gaps: due.gaps };
    return { ok: true, paidOn, expenseType, confirmedGaps: due.gaps };
  }
  return { ok: true, paidOn, expenseType, confirmedGaps: null };
}

export interface ReleaseInput {
  /** Empty = today in Libya. */
  releasedOn?: string | null;
  /** The owner ticked «أؤكد الإفراج» after seeing the warning. */
  confirmed?: boolean;
}

export type ReleaseDecision =
  | { ok: true; releasedOn: string; /** True when the owner confirmed releasing while a phase is not done. */ confirmedEarly: boolean }
  | { ok: false; kind: 'invalid'; errors: PayError[] }
  | { ok: false; kind: 'needs_confirm' };

/**
 * Release the retained part (FR-FIN-09). Allowed at any time (handover, 3.23, is not built), with a warning while some
 * phase is not done (D2). Never before the payment date.
 * @param today the date in Libya.
 */
export function decideRelease(input: ReleaseInput, ctx: { today: string; paidOn: string; allPhasesDone: boolean }): ReleaseDecision {
  let releasedOn = ctx.today;
  const date = clean(input.releasedOn);
  if (date !== '') {
    if (!isIsoDate(date)) return { ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'invalid_date' }] };
    if (date > ctx.today) return { ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'date_in_future' }] };
    if (date < ctx.paidOn) return { ok: false, kind: 'invalid', errors: [{ field: 'releasedOn', code: 'before_paid' }] };
    releasedOn = date;
  } else if (releasedOn < ctx.paidOn) {
    releasedOn = ctx.paidOn;
  }
  if (!ctx.allPhasesDone) {
    if (input.confirmed !== true) return { ok: false, kind: 'needs_confirm' };
    return { ok: true, releasedOn, confirmedEarly: true };
  }
  return { ok: true, releasedOn, confirmedEarly: false };
}

const truncate = (s: string, max: number) => ([...s].length <= max ? s : `${[...s].slice(0, max - 1).join('')}…`);

interface ExpenseContext {
  contractTitle: string;
  paymentTitle: string;
  contractor: string;
  phaseId: string | null;
}

/**
 * The expense of a payment (FR-FIN-09): the amount minus the retained part, keyed by the payment id so a retry never
 * makes a second one. null when the whole payment is retained: nothing leaves now, the release makes the expense.
 */
export function expenseFromPayment(
  p: ExpenseContext & { paymentId: string; amountLyd: MoneyInput; retainedLyd: MoneyInput; paidOn: string; expenseType: ExpenseType },
): NewExpenseInput | null {
  const cash = cashNow(p);
  if (!cash.gt(0)) return null;
  return {
    title: truncate(`${p.paymentTitle} · ${p.contractTitle}`, EXPENSE_TITLE_MAX),
    amount: cash.toFixed(3),
    expenseType: p.expenseType,
    phaseId: p.phaseId,
    payee: truncate(p.contractor, EXPENSE_PAYEE_MAX),
    paidOn: p.paidOn,
    clientOpId: p.paymentId,
  };
}

/** The second expense: the retained part, on the day the owner releases it. Keyed by the payment's own release_op_id. */
export function expenseFromRelease(
  p: ExpenseContext & { releaseOpId: string; retainedLyd: MoneyInput; releasedOn: string; expenseType: ExpenseType },
): NewExpenseInput {
  return {
    title: truncate(`إفراج المحتجز · ${p.paymentTitle} · ${p.contractTitle}`, EXPENSE_TITLE_MAX),
    amount: money(p.retainedLyd).toFixed(3),
    expenseType: p.expenseType,
    phaseId: p.phaseId,
    payee: truncate(p.contractor, EXPENSE_PAYEE_MAX),
    paidOn: p.releasedOn,
    clientOpId: p.releaseOpId,
  };
}

