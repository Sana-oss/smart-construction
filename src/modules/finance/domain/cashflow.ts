import { addMoney, isIsoDate, money, subMoney, type Money, type MoneyInput } from '@/shared-kernel';
import { readAmountLyd, type ExpenseErrorCode } from './expense';

// Obligations and expected income, and the cash outlook (FR-FIN-06, FR-FIN-07; design S16.1 «الالتزامات والدخل»,
// S16.2 «إضافة حركة متوقعة»; the timing rule of FR-DEC-01). Slice 1 of 3.7 (owner's decision of 19 Nov 2026).
// Pure: no React, no database. Money is Decimal; dates are "YYYY-MM-DD" in Libya.
//
// A "movement" is money that WILL move: income the owner expects, or an obligation they must pay. It is not an expense:
// nothing has been paid yet (S16.2: «لا تُسجل كمصروف مدفوع»).

export const MOVEMENT_KINDS = ['income', 'obligation'] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

/** The design's window: S16.1 «متابعة السيولة خلال 30 يومًا», S18.1 «الرصيد المتوقع بعد 30 يومًا». */
export const CASHFLOW_HORIZON_DAYS = 30;

/** Project decisions (19 Nov 2026), like the expense name (16 Nov). */
export const MOVEMENT_TEXT_MIN = 2;
export const MOVEMENT_TEXT_MAX = 80;

export type MovementField = 'kind' | 'title' | 'amount' | 'date' | 'party';
export type MovementErrorCode = ExpenseErrorCode;
export interface MovementError {
  field: MovementField;
  code: MovementErrorCode;
}

/** What the S16.2 form sends, as typed. */
export interface MovementInput {
  kind?: string | null;
  /** «الوصف», e.g. «دفعة تمويل من المالك». */
  title?: string | null;
  amount?: string | null;
  /** «التاريخ المتوقع»: when the income arrives or the obligation is due. A past date is allowed (an overdue one). */
  date?: string | null;
  /** «المصدر أو المستفيد»: who pays the income, or who is owed. */
  party?: string | null;
}

export interface NewMovement {
  kind: MovementKind;
  title: string;
  amountLyd: Money;
  date: string;
  party: string;
}

export type MovementValidation = { ok: true; value: NewMovement } | { ok: false; errors: MovementError[] };

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

export function validateMovement(input: MovementInput): MovementValidation {
  const errors: MovementError[] = [];

  const kind = clean(input.kind);
  if (kind === '') errors.push({ field: 'kind', code: 'required' });
  else if (!(MOVEMENT_KINDS as readonly string[]).includes(kind)) errors.push({ field: 'kind', code: 'unknown_choice' });

  const text = (field: 'title' | 'party', raw: string | null | undefined) => {
    const v = clean(raw);
    if (v === '') errors.push({ field, code: 'required' });
    else if (length(v) < MOVEMENT_TEXT_MIN) errors.push({ field, code: 'too_short' });
    else if (length(v) > MOVEMENT_TEXT_MAX) errors.push({ field, code: 'too_long' });
    return v;
  };
  const title = text('title', input.title);
  const amountLyd = readAmountLyd(input.amount, (code) => errors.push({ field: 'amount', code }));

  const date = clean(input.date);
  if (date === '') errors.push({ field: 'date', code: 'required' });
  else if (!isIsoDate(date)) errors.push({ field: 'date', code: 'invalid_date' });

  const party = text('party', input.party);

  if (errors.length > 0 || amountLyd === null) return { ok: false, errors };
  return { ok: true, value: { kind: kind as MovementKind, title, amountLyd, date, party } };
}

/** "2026-11-19" + 30 -> "2026-12-19". Noon UTC keeps the calendar day. */
export function addDays(date: string, days: number): string {
  if (!isIsoDate(date)) throw new Error(`addDays expects "YYYY-MM-DD", got "${date}"`);
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export interface Liquidity {
  amount: Money;
  /** The date of the owner's «المتاح» figure (wizard S02.3). */
  asOf: string;
}

/**
 * «السيولة الحالية»: the money the owner said was available on `asOf` (wizard), minus the expenses recorded in the app
 * and paid on or after that date. Expenses dated before it are assumed to be already outside that figure (a stated
 * limit). Null when the owner never gave the figure: the outlook then shows it as missing (FR-DEC-03).
 */
export function currentLiquidity(
  availableNow: MoneyInput | null,
  availableAsOf: string | null,
  expenses: readonly { amountLyd: MoneyInput; paidOn: string }[],
): Liquidity | null {
  if (availableNow === null || availableAsOf === null) return null;
  const spentSince = addMoney('0', ...expenses.filter((e) => e.paidOn >= availableAsOf).map((e) => e.amountLyd));
  return { amount: subMoney(availableNow, spentSince), asOf: availableAsOf };
}

export interface Movement {
  kind: MovementKind;
  amountLyd: MoneyInput;
  date: string;
}

export interface CashflowOutlook {
  /** The last day counted: today + CASHFLOW_HORIZON_DAYS. */
  until: string;
  /** Expected income dated up to `until` (an overdue one counts as arriving today). */
  income: Money;
  /** Obligations due up to `until`, including overdue ones (due today, at the latest). */
  obligations: Money;
  overdueObligations: number;
  /** «الرصيد المتوقع بعد 30 يومًا» = liquidity + income − obligations. */
  balanceAtEnd: Money;
  /**
   * The timing rule (FR-DEC-01): income that arrives AFTER an obligation does not cover it. Day by day, the first
   * day the balance goes below zero, and the lowest balance in the window. Null when it never does.
   */
  shortfall: { from: string; lowest: Money } | null;
}

/**
 * The next 30 days, day by day. On the same day obligations are paid before income arrives (the careful order:
 * income may come late in the day). Movements after `until` are left out; the list still shows them.
 */
export function cashflowOutlook(liquidity: MoneyInput, movements: readonly Movement[], today: string): CashflowOutlook {
  const until = addDays(today, CASHFLOW_HORIZON_DAYS);
  const inWindow = movements
    .filter((m) => m.date <= until)
    .map((m) => ({ ...m, day: m.date < today ? today : m.date }))
    .sort((a, b) => (a.day === b.day ? (a.kind === b.kind ? 0 : a.kind === 'obligation' ? -1 : 1) : a.day < b.day ? -1 : 1));

  let balance = money(liquidity);
  let shortfall: CashflowOutlook['shortfall'] = balance.lt(0) ? { from: today, lowest: balance } : null;
  for (const m of inWindow) {
    balance = m.kind === 'income' ? addMoney(balance, m.amountLyd) : subMoney(balance, m.amountLyd);
    if (balance.lt(0)) {
      if (!shortfall) shortfall = { from: m.day, lowest: balance };
      else if (balance.lt(shortfall.lowest)) shortfall = { ...shortfall, lowest: balance };
    }
  }

  const sum = (kind: MovementKind) => addMoney('0', ...inWindow.filter((m) => m.kind === kind).map((m) => m.amountLyd));
  return {
    until,
    income: sum('income'),
    obligations: sum('obligation'),
    overdueObligations: movements.filter((m) => m.kind === 'obligation' && m.date < today).length,
    balanceAtEnd: balance,
    shortfall,
  };
}
