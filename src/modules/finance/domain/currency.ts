import { isIsoDate, money, readMoneyInput, toAsciiDigits, type Money } from '@/shared-kernel';

// Foreign currency and the owner's reference exchange rate (3.18, FR-FIN-04, UC-08). Pure: no React, no database.
// Owner's decisions of 20 Nov 2026 (change register): four currencies; an optional section at the end of the quick
// expense; a simple log of reference rates that pre-fills the expense form. The rate is the OWNER's (what they paid, or
// the market rate they use): never fetched, never forecast, never claimed to be official.
// Money stays in LYD everywhere: a foreign expense keeps its original amount, currency and rate, and its LYD equivalent
// is what every total uses.

/** USD, EUR, TRY, CNY: most imported building materials in Libya (decision of 20 Nov 2026). The database has the same list. */
export const CURRENCIES = ['USD', 'EUR', 'TRY', 'CNY'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => (CURRENCIES as readonly unknown[]).includes(v);

/** exchange_rates.lyd_per_unit and expenses.rate_lyd_per_unit are numeric(12,4): 8 digits, 4 decimals. */
export const RATE_DECIMALS = 4;
export const RATE_NOTE_MAX = 200;

export type RateErrorCode = 'required' | 'invalid_number' | 'must_be_positive' | 'too_large';

/** "7,25" / "٧٫٢٥" / "7.2500" -> "7.2500" (canonical, 4 places), or an error code. */
export function readRate(raw: string | null | undefined): { ok: true; value: string } | { ok: false; code: RateErrorCode } {
  const s = toAsciiDigits((raw ?? '').trim()).replace(/[٫,]/g, '.').replace(/\s/g, '');
  if (s === '') return { ok: false, code: 'required' };
  const m = /^(\d+)(?:\.(\d{1,4}))?$/.exec(s);
  if (!m) return { ok: false, code: 'invalid_number' };
  const whole = m[1].replace(/^0+(?=\d)/, '');
  if (whole.length > 8) return { ok: false, code: 'too_large' };
  // Built as text: money() keeps 3 places, a rate keeps 4 ("0.1234" must not become "0.123").
  const decimals = (m[2] ?? '').padEnd(RATE_DECIMALS, '0');
  if (/^0+$/.test(whole) && /^0+$/.test(decimals)) return { ok: false, code: 'must_be_positive' };
  return { ok: true, value: `${whole}.${decimals}` };
}

export type ForeignField = 'currency' | 'originalAmount' | 'rate';
export type ForeignErrorCode = RateErrorCode | 'unknown_choice';

export interface ForeignInput {
  currency?: string | null;
  originalAmount?: string | null;
  rate?: string | null;
}

export interface ForeignAmount {
  currency: Currency;
  /** In the foreign currency, 3 places (numeric(14,3)). */
  originalAmount: Money;
  /** LYD for one unit, 4 places, as a canonical string ("7.2500"). */
  rateLydPerUnit: string;
  /** The LYD equivalent: original × rate, rounded half up to 3 places. The database checks the same (0020). */
  amountLyd: Money;
}

/** True when the owner opened the foreign-currency section and chose a currency. */
export const usesForeignCurrency = (input: ForeignInput) => (input.currency ?? '').trim() !== '';

/** The LYD equivalent of an amount at a rate: rounded half up to 3 places (the dirham). */
export function toLyd(originalAmount: Money | string, rateLydPerUnit: string): Money {
  return money(money(originalAmount).times(rateLydPerUnit));
}

export function validateForeign(
  input: ForeignInput,
): { ok: true; value: ForeignAmount } | { ok: false; errors: { field: ForeignField; code: ForeignErrorCode | 'too_large' }[] } {
  const errors: { field: ForeignField; code: ForeignErrorCode | 'too_large' }[] = [];
  const currency = (input.currency ?? '').trim().toUpperCase();
  if (!isCurrency(currency)) errors.push({ field: 'currency', code: currency === '' ? 'required' : 'unknown_choice' });
  const amount = readMoneyInput(input.originalAmount);
  if (!amount.ok) errors.push({ field: 'originalAmount', code: amount.code });
  const rate = readRate(input.rate);
  if (!rate.ok) errors.push({ field: 'rate', code: rate.code });
  if (errors.length > 0 || !amount.ok || !rate.ok) return { ok: false, errors };

  const amountLyd = toLyd(amount.value, rate.value);
  // The LYD equivalent must fit numeric(14,3) and stay above zero (a tiny amount at a tiny rate could round to 0).
  if (amountLyd.lte(0)) return { ok: false, errors: [{ field: 'originalAmount', code: 'must_be_positive' }] };
  if (amountLyd.toFixed(0).replace('-', '').length > 11) return { ok: false, errors: [{ field: 'originalAmount', code: 'too_large' }] };
  return { ok: true, value: { currency: currency as Currency, originalAmount: amount.value, rateLydPerUnit: rate.value, amountLyd } };
}

// ---------------------------------------------------------------------------------------------------------------
// The log of reference rates (table exchange_rates).

export type RateField = 'currency' | 'rate' | 'rateDate' | 'note';
export type RateLogErrorCode = RateErrorCode | 'unknown_choice' | 'invalid_date' | 'date_in_future' | 'too_long';

export interface RateInput {
  currency?: string | null;
  rate?: string | null;
  /** Empty = today in Libya. */
  rateDate?: string | null;
  note?: string | null;
}

export interface NewRate {
  currency: Currency;
  lydPerUnit: string;
  /** null = today in Libya (the database's default). */
  rateDate: string | null;
  note: string | null;
}

/** @param today the date in Libya. A rate is one the owner saw or paid: not in the future. */
export function validateRate(input: RateInput, today: string): { ok: true; value: NewRate } | { ok: false; errors: { field: RateField; code: RateLogErrorCode }[] } {
  const errors: { field: RateField; code: RateLogErrorCode }[] = [];
  const currency = (input.currency ?? '').trim().toUpperCase();
  if (!isCurrency(currency)) errors.push({ field: 'currency', code: currency === '' ? 'required' : 'unknown_choice' });
  const rate = readRate(input.rate);
  if (!rate.ok) errors.push({ field: 'rate', code: rate.code });
  let rateDate: string | null = null;
  const date = (input.rateDate ?? '').trim();
  if (date !== '') {
    if (!isIsoDate(date)) errors.push({ field: 'rateDate', code: 'invalid_date' });
    else if (date > today) errors.push({ field: 'rateDate', code: 'date_in_future' });
    else rateDate = date;
  }
  const note = (input.note ?? '').trim().replace(/\s+/g, ' ') || null;
  if (note !== null && [...note].length > RATE_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });
  if (errors.length > 0 || !rate.ok) return { ok: false, errors };
  return { ok: true, value: { currency: currency as Currency, lydPerUnit: rate.value, rateDate, note } };
}

export interface RateRecord {
  id: string;
  currency: Currency;
  /** "7.2500" */
  lydPerUnit: string;
  rateDate: string;
  note: string | null;
  createdAt: string;
}

const newestFirst = (a: RateRecord, b: RateRecord) =>
  a.rateDate === b.rateDate ? b.createdAt.localeCompare(a.createdAt) : a.rateDate < b.rateDate ? 1 : -1;

/** The log, newest first. */
export const sortRates = (records: readonly RateRecord[]) => [...records].sort(newestFirst);

/** The latest rate of each currency, to pre-fill the expense form. Currencies without a rate are absent. */
export function latestRates(records: readonly RateRecord[]): Partial<Record<Currency, RateRecord>> {
  const out: Partial<Record<Currency, RateRecord>> = {};
  for (const r of sortRates(records)) out[r.currency] ??= r;
  return out;
}

/** A foreign amount as stored and shown (decimal strings, never JS numbers). */
export interface ForeignRecord {
  currency: Currency;
  /** "1000.000" */
  originalAmount: string;
  /** "7.2500" */
  rateLydPerUnit: string;
}

export const toForeignRecord = (f: ForeignAmount | null): ForeignRecord | null =>
  f === null ? null : { currency: f.currency, originalAmount: f.originalAmount.toFixed(3), rateLydPerUnit: f.rateLydPerUnit };
