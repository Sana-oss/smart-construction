import Decimal from 'decimal.js';
import type { MoneyInput } from './money';

/**
 * Money for display, as in the design ("450,000"): thousands grouped with commas, up to 3 decimals and only when
 * they are not zero ("1,250.5"). Display only: never parse this back into a number for calculations.
 */
export function formatAmount(value: MoneyInput): string {
  const d = new Decimal(value).toDecimalPlaces(3);
  const [int, frac] = d.abs().toFixed(3).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const decimals = frac.replace(/0+$/, '');
  return `${d.isNegative() ? '-' : ''}${grouped}${decimals ? `.${decimals}` : ''}`;
}
