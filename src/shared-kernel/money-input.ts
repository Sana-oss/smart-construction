import { parseDecimalInput } from './digits';
import { money, type Money } from './money';

// Reading an amount in LYD as a person typed it ("12,000", "١٢٬٥٠٠٫٥"). In the shared kernel because more than one
// module of the same level reads money (finance: expenses, obligations; materials: prices), and they may not import
// each other (rule R2). Every money field of the app accepts and refuses exactly the same text.

export type MoneyInputError = 'required' | 'invalid_number' | 'too_large' | 'must_be_positive';

export type MoneyInputResult = { ok: true; value: Money } | { ok: false; code: MoneyInputError };

/**
 * @param allowZero true for prices (FR-MAT-08: «السعر غير سالب»: a free item is 0); false for amounts paid or owed.
 * A minus sign is never accepted ("invalid_number"): no amount typed in the app is negative.
 */
export function readMoneyInput(raw: string | null | undefined, { allowZero = false }: { allowZero?: boolean } = {}): MoneyInputResult {
  if ((raw ?? '').trim() === '') return { ok: false, code: 'required' };
  const parsed = parseDecimalInput(raw);
  // The dinar has 1,000 dirhams: at most 3 decimals. More is refused, not silently rounded.
  if (parsed === null || !/^\d+(\.\d{1,3})?$/.test(parsed)) return { ok: false, code: 'invalid_number' };
  // The database stores money as numeric(14,3): at most 11 digits before the decimal point.
  if (parsed.split('.')[0].length > 11) return { ok: false, code: 'too_large' };
  const value = money(parsed);
  if (!allowZero && value.lte(0)) return { ok: false, code: 'must_be_positive' };
  return { ok: true, value };
}
