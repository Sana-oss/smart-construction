import Decimal from 'decimal.js';

// Money is never a JS number. All amounts are Decimal, rounded half-up to 3 places (LYD).
const D = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

export type Money = Decimal;
export type MoneyInput = string | Decimal; // numbers are rejected on purpose (float risk)

export const money = (value: MoneyInput): Money => new D(value).toDecimalPlaces(3);
export const addMoney = (...values: MoneyInput[]): Money =>
  money(values.reduce<Decimal>((sum, v) => sum.plus(new D(v)), new D(0)));
export const subMoney = (a: MoneyInput, b: MoneyInput): Money => money(new D(a).minus(new D(b)));
export const percentOf = (amount: MoneyInput, pct: MoneyInput): Money =>
  money(new D(amount).times(new D(pct)).div(100));
export const convertMoney = (amount: MoneyInput, lydPerUnit: MoneyInput): Money =>
  money(new D(amount).times(new D(lydPerUnit)));
/** Serialize for PostgreSQL numeric(14,3). */
export const toDb = (m: Money): string => m.toFixed(3);
