import { isIsoDate, isUuid, readMoneyInput, type Money } from '@/shared-kernel';
import { usesForeignCurrency, validateForeign, type ForeignAmount } from './currency';

// Rules for recording an expense (FR-FIN-02, UC-07; design screen S14.1 "مصروف سريع").
// Pure: no React, Next or Supabase (rule R4). Money stays Decimal, never a JS number.
//
// The six fields of the design (decision of 16 Nov 2026, change register): name, amount, type, phase,
// supplier or beneficiary, date. The owner must TYPE three of them (name, amount, type); the phase and the
// date are filled in by the screen (current phase, today) and the supplier is optional.
// Foreign currency (FR-FIN-04, 3.18) is an optional section at the end (currency.ts); the receipt photo too (receipt.ts).

/**
 * The expense types shown in the design (S13.1 rows: «مواد», «عمالة», «خدمات»). Stored as these English keys;
 * the Arabic labels live in the UI messages. The database has the same list in a check constraint (0009).
 */
export const EXPENSE_TYPES = ['materials', 'labor', 'services'] as const;
export type ExpenseType = (typeof EXPENSE_TYPES)[number];

/** Project decisions (16 Nov 2026, change register), not legal or accounting rules. */
export const EXPENSE_TITLE_MIN = 2;
export const EXPENSE_TITLE_MAX = 80;
export const EXPENSE_PAYEE_MAX = 80;

export type ExpenseField =
  | 'title'
  | 'amount'
  | 'expenseType'
  | 'phaseId'
  | 'payee'
  | 'paidOn'
  | 'clientOpId'
  // Foreign currency (3.18, FR-FIN-04): optional, at the end of the form.
  | 'currency'
  | 'originalAmount'
  | 'rate';

export type ExpenseErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_number'
  | 'must_be_positive'
  | 'too_large'
  | 'unknown_choice'
  | 'invalid_id'
  | 'invalid_date'
  | 'date_in_future';

export interface ExpenseError {
  field: ExpenseField;
  code: ExpenseErrorCode;
}

/** What the form sends: text exactly as the owner typed it. */
export interface NewExpenseInput {
  /** What the money was paid for, e.g. «حديد تسليح». */
  title?: string | null;
  amount?: string | null;
  /** One of EXPENSE_TYPES. */
  expenseType?: string | null;
  phaseId?: string | null;
  /** Supplier or beneficiary. Optional. */
  payee?: string | null;
  /** "YYYY-MM-DD". Empty means today (in Libya). */
  paidOn?: string | null;
  /**
   * Paid in a foreign currency (3.18, FR-FIN-04; optional). When a currency is chosen, the amount in LYD is NOT typed:
   * it is original × rate (validateForeign), and `amount` is ignored.
   */
  currency?: string | null;
  originalAmount?: string | null;
  /** The owner's reference rate: LYD for one unit of the currency. */
  rate?: string | null;
  /**
   * Made once by the browser for each expense the owner records (crypto.randomUUID). If the same request is
   * sent again (weak connection, double tap, offline queue), the server finds this id and does NOT create a
   * second expense (NFR-REL-01).
   */
  clientOpId?: string | null;
}

/** A validated expense, ready to store. */
export interface NewExpense {
  title: string;
  amountLyd: Money;
  expenseType: ExpenseType;
  phaseId: string | null;
  payee: string | null;
  /** null = let the database use today's date in Libya. */
  paidOn: string | null;
  /** Null for an expense paid in LYD. Otherwise amountLyd is its LYD equivalent. */
  foreign: ForeignAmount | null;
  clientOpId: string;
}

export type ExpenseValidation = { ok: true; value: NewExpense } | { ok: false; errors: ExpenseError[] };

/** What the edit form sends (no clientOpId: an edit changes an expense that already exists). */
export type ExpenseEditInput = Omit<NewExpenseInput, 'clientOpId'>;

/** A validated edit. Unlike a new expense, the date is always given: the edit form shows the stored date. */
export interface ExpenseEdit extends Omit<NewExpense, 'clientOpId' | 'paidOn'> {
  paidOn: string;
}

export type ExpenseEditValidation = { ok: true; value: ExpenseEdit } | { ok: false; errors: ExpenseError[] };

const blank = (s: string | null | undefined) => (s ?? '').trim() === '';
/** Trim and turn any run of spaces into one space. */
const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
/** Length in characters as a person counts them (an Arabic letter is one, whatever its bytes). */
const length = (s: string) => [...s].length;

/**
 * An amount in LYD as the owner typed it -> Money, or null after reporting why. Shared by every money field of the
 * finance module (expenses, obligations, expected income), so they all accept and refuse exactly the same text.
 */
export function readAmountLyd(raw: string | null | undefined, onError: (code: ExpenseErrorCode) => void): Money | null {
  // The rules live in the shared kernel (readMoneyInput) so prices (materials module) read money the same way.
  const r = readMoneyInput(raw);
  if (r.ok) return r.value;
  onError(r.code);
  return null;
}

/** The rules shared by a new expense and an edit: one place, so both screens accept exactly the same values. */
function readFields(input: ExpenseEditInput, today: string, errors: ExpenseError[]): Omit<NewExpense, 'clientOpId'> | null {
  const title = clean(input.title);
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if (length(title) < EXPENSE_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if (length(title) > EXPENSE_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  // In LYD as typed, or (3.18) the LYD equivalent of a foreign amount at the owner's rate.
  let amountLyd: Money | null = null;
  let foreign: ForeignAmount | null = null;
  if (usesForeignCurrency(input)) {
    const f = validateForeign(input);
    if (f.ok) {
      foreign = f.value;
      amountLyd = f.value.amountLyd;
    } else errors.push(...f.errors);
  } else {
    amountLyd = readAmountLyd(input.amount, (code) => errors.push({ field: 'amount', code }));
  }

  const type = clean(input.expenseType);
  if (type === '') errors.push({ field: 'expenseType', code: 'required' });
  else if (!(EXPENSE_TYPES as readonly string[]).includes(type)) errors.push({ field: 'expenseType', code: 'unknown_choice' });

  // Optional reference to a phase: empty means "none"; anything else must look like an id.
  let phaseId: string | null = null;
  if (!blank(input.phaseId)) {
    const id = (input.phaseId as string).trim().toLowerCase();
    if (isUuid(id)) phaseId = id;
    else errors.push({ field: 'phaseId', code: 'invalid_id' });
  }

  const payee = blank(input.payee) ? null : clean(input.payee);
  if (payee !== null && length(payee) > EXPENSE_PAYEE_MAX) errors.push({ field: 'payee', code: 'too_long' });

  let paidOn: string | null = null;
  if (!blank(input.paidOn)) {
    const date = (input.paidOn as string).trim();
    if (!isIsoDate(date)) errors.push({ field: 'paidOn', code: 'invalid_date' });
    else if (date > today) errors.push({ field: 'paidOn', code: 'date_in_future' }); // "YYYY-MM-DD" sorts as text
    else paidOn = date;
  }

  if (errors.length > 0 || amountLyd === null) return null;
  return { title, amountLyd, expenseType: type as ExpenseType, phaseId, payee, paidOn, foreign };
}

/**
 * @param today Today's date in Libya, "YYYY-MM-DD" (todayInTripoli() from the shared kernel). Passed in so this
 *   function stays pure and testable. An expense is money already paid, so its date cannot be after today.
 */
export function validateNewExpense(input: NewExpenseInput, today: string): ExpenseValidation {
  const errors: ExpenseError[] = [];
  const fields = readFields(input, today, errors);

  let clientOpId = '';
  if (blank(input.clientOpId)) errors.push({ field: 'clientOpId', code: 'required' });
  else if (!isUuid((input.clientOpId as string).trim())) errors.push({ field: 'clientOpId', code: 'invalid_id' });
  else clientOpId = (input.clientOpId as string).trim().toLowerCase();

  if (errors.length > 0 || fields === null) return { ok: false, errors };
  return { ok: true, value: { ...fields, clientOpId } };
}

/**
 * Editing an expense (decision of 19 Nov 2026, change register): the same six fields and the same rules as a new
 * expense, except that the date is required (an empty date on an edit would silently move the expense to today).
 * @param today Today's date in Libya, "YYYY-MM-DD".
 */
export function validateExpenseEdit(input: ExpenseEditInput, today: string): ExpenseEditValidation {
  const errors: ExpenseError[] = [];
  const fields = readFields(input, today, errors);
  if (blank(input.paidOn)) errors.push({ field: 'paidOn', code: 'required' });
  if (errors.length > 0 || fields === null || fields.paidOn === null) return { ok: false, errors };
  return { ok: true, value: { ...fields, paidOn: fields.paidOn } };
}
