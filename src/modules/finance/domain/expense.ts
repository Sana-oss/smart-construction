import { isIsoDate, isUuid, money, parseDecimalInput, type Money } from '@/shared-kernel';

// Rules for recording an expense (FR-FIN-02, UC-07). Pure: no React, Next or Supabase (rule R4).
// Only the amount is required. Category, phase, note and date are optional, so the quick entry stays at
// 3 taps (NFR-USE-03). Foreign currency (FR-FIN-04) and the receipt photo come later.
// Money stays Decimal, never a JS number.

/** Project decision (16 Nov 2026, change register), not a legal or accounting rule. */
export const EXPENSE_NOTE_MAX = 500;

export type ExpenseField = 'amount' | 'categoryId' | 'phaseId' | 'note' | 'paidOn' | 'clientOpId';

export type ExpenseErrorCode =
  | 'required'
  | 'invalid_number'
  | 'must_be_positive'
  | 'too_large'
  | 'too_long'
  | 'invalid_id'
  | 'invalid_date'
  | 'date_in_future';

export interface ExpenseError {
  field: ExpenseField;
  code: ExpenseErrorCode;
}

/** What the form sends: text exactly as the owner typed it. */
export interface NewExpenseInput {
  amount?: string | null;
  categoryId?: string | null;
  phaseId?: string | null;
  note?: string | null;
  /** "YYYY-MM-DD". Empty means today (in Libya). */
  paidOn?: string | null;
  /**
   * Made once by the browser for each expense the owner records (crypto.randomUUID). If the same request is
   * sent again (weak connection, double tap, offline queue), the server finds this id and does NOT create a
   * second expense (NFR-REL-01).
   */
  clientOpId?: string | null;
}

/** A validated expense, ready to store. */
export interface NewExpense {
  amountLyd: Money;
  categoryId: string | null;
  phaseId: string | null;
  note: string | null;
  /** null = let the database use today's date in Libya. */
  paidOn: string | null;
  clientOpId: string;
}

export type ExpenseValidation = { ok: true; value: NewExpense } | { ok: false; errors: ExpenseError[] };

const blank = (s: string | null | undefined) => (s ?? '').trim() === '';

function readAmount(raw: string | null | undefined, errors: ExpenseError[]): Money | null {
  const fail = (code: ExpenseErrorCode) => {
    errors.push({ field: 'amount', code });
    return null;
  };
  if (blank(raw)) return fail('required');
  const parsed = parseDecimalInput(raw);
  // The dinar has 1,000 dirhams: at most 3 decimals. More is refused, not silently rounded.
  if (parsed === null || !/^\d+(\.\d{1,3})?$/.test(parsed)) return fail('invalid_number');
  // The database stores money as numeric(14,3): at most 11 digits before the decimal point.
  if (parsed.split('.')[0].length > 11) return fail('too_large');
  const amount = money(parsed);
  return amount.lte(0) ? fail('must_be_positive') : amount;
}

/** An optional reference to another row: empty means "none"; anything else must look like an id. */
function readOptionalId(field: ExpenseField, raw: string | null | undefined, errors: ExpenseError[]): string | null {
  if (blank(raw)) return null;
  const id = (raw as string).trim().toLowerCase();
  if (!isUuid(id)) {
    errors.push({ field, code: 'invalid_id' });
    return null;
  }
  return id;
}

/**
 * @param today Today's date in Libya, "YYYY-MM-DD" (todayInTripoli() from the shared kernel). Passed in so this
 *   function stays pure and testable. An expense is money already paid, so its date cannot be after today.
 */
export function validateNewExpense(input: NewExpenseInput, today: string): ExpenseValidation {
  const errors: ExpenseError[] = [];

  const amountLyd = readAmount(input.amount, errors);
  const categoryId = readOptionalId('categoryId', input.categoryId, errors);
  const phaseId = readOptionalId('phaseId', input.phaseId, errors);

  const note = blank(input.note) ? null : (input.note as string).trim().replace(/\s+/g, ' ');
  if (note !== null && [...note].length > EXPENSE_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });

  let paidOn: string | null = null;
  if (!blank(input.paidOn)) {
    const date = (input.paidOn as string).trim();
    if (!isIsoDate(date)) errors.push({ field: 'paidOn', code: 'invalid_date' });
    else if (date > today) errors.push({ field: 'paidOn', code: 'date_in_future' }); // "YYYY-MM-DD" sorts as text
    else paidOn = date;
  }

  let clientOpId = '';
  if (blank(input.clientOpId)) errors.push({ field: 'clientOpId', code: 'required' });
  else if (!isUuid((input.clientOpId as string).trim())) errors.push({ field: 'clientOpId', code: 'invalid_id' });
  else clientOpId = (input.clientOpId as string).trim().toLowerCase();

  if (errors.length > 0 || amountLyd === null) return { ok: false, errors };
  return { ok: true, value: { amountLyd, categoryId, phaseId, note, paidOn, clientOpId } };
}
