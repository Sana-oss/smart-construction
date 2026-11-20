import Decimal from 'decimal.js';
import { isIsoDate, isUuid, money, parseDecimalInput, readMoneyInput, type Money, type MoneyInputError } from '@/shared-kernel';
import { MATERIAL_MAX, MATERIAL_MIN, SUPPLIER_MAX, UNIT_MAX } from './price';

// The quantity table and purchases (3.3 slice 2 / 3.9; FR-MAT-01, FR-MAT-02, FR-MAT-03; design S20.1 «بنود المواد»,
// S20.2 «تفاصيل بند», S21.1 «تسجيل شراء»). Pure: no React, no database.
//
// Engineering content: the planned quantity and the allowed waste come from the ENGINEER's bill of quantities, typed by
// the owner. The app never suggests a waste percentage (decision D10 is open): empty means 0.

const D = Decimal.clone({ precision: 30, rounding: Decimal.ROUND_HALF_UP });

/** Text limits: project decisions (20 Nov 2026), like the other text fields. */
export const SOURCE_MAX = 80;
export const VERIFIED_BY_MAX = 80;
/** numeric(14,3): at most 11 digits before the decimal point. */
const QTY_MAX = new D('99999999999.999');

export type QuantityErrorCode =
  | MoneyInputError
  | 'too_short'
  | 'too_long'
  | 'too_many_decimals'
  | 'invalid_date'
  | 'date_in_future'
  | 'invalid_reference';

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

/** A positive quantity with up to `places` decimals ("١٢٫٥" -> 12.5). */
function readQuantity(raw: string | null | undefined, places = 3): { ok: true; value: Decimal } | { ok: false; code: QuantityErrorCode } {
  if ((raw ?? '').trim() === '') return { ok: false, code: 'required' };
  const parsed = parseDecimalInput(raw);
  if (parsed === null) return { ok: false, code: 'invalid_number' };
  if ((parsed.split('.')[1] ?? '').length > places) return { ok: false, code: 'too_many_decimals' };
  const value = new D(parsed);
  if (value.lte(0)) return { ok: false, code: 'must_be_positive' };
  if (value.gt(QTY_MAX)) return { ok: false, code: 'too_large' };
  return { ok: true, value };
}

// ---------------------------------------------------------------------------------------------------------------
// FR-MAT-01: one line of the quantity table.

export type ItemField = 'material' | 'unit' | 'plannedQty' | 'wastePct' | 'phaseId' | 'source' | 'verifiedBy';
export interface ItemError {
  field: ItemField;
  code: QuantityErrorCode;
}

export interface ItemInput {
  material?: string | null;
  unit?: string | null;
  plannedQty?: string | null;
  /** «نسبة الهدر المسموحة» from the engineer; empty = 0. */
  wastePct?: string | null;
  phaseId?: string | null;
  /** Where the quantity comes from, e.g. «جدول كميات المهندس». */
  source?: string | null;
  /** «اسم المراجع»: who checked the quantity. */
  verifiedBy?: string | null;
}

export interface NewItem {
  material: string;
  unit: string;
  plannedQty: Decimal;
  wastePct: Decimal;
  phaseId: string | null;
  source: string | null;
  verifiedBy: string | null;
}

export function validateItem(input: ItemInput): { ok: true; value: NewItem } | { ok: false; errors: ItemError[] } {
  const errors: ItemError[] = [];
  const push = (field: ItemField, code: QuantityErrorCode) => errors.push({ field, code });

  const material = clean(input.material);
  if (material === '') push('material', 'required');
  else if (length(material) < MATERIAL_MIN) push('material', 'too_short');
  else if (length(material) > MATERIAL_MAX) push('material', 'too_long');

  const unit = clean(input.unit);
  if (unit === '') push('unit', 'required');
  else if (length(unit) > UNIT_MAX) push('unit', 'too_long');

  const planned = readQuantity(input.plannedQty);
  if (!planned.ok) push('plannedQty', planned.code);

  let wastePct = new D(0);
  if ((input.wastePct ?? '').trim() !== '') {
    const parsed = parseDecimalInput(input.wastePct);
    if (parsed === null) push('wastePct', 'invalid_number');
    else if ((parsed.split('.')[1] ?? '').length > 2) push('wastePct', 'too_many_decimals');
    else if (new D(parsed).gt(100)) push('wastePct', 'too_large');
    else wastePct = new D(parsed);
  }

  const phaseId = clean(input.phaseId) || null;
  if (phaseId !== null && !isUuid(phaseId)) push('phaseId', 'invalid_reference');

  const source = clean(input.source) || null;
  if (source !== null && length(source) > SOURCE_MAX) push('source', 'too_long');
  const verifiedBy = clean(input.verifiedBy) || null;
  if (verifiedBy !== null && length(verifiedBy) > VERIFIED_BY_MAX) push('verifiedBy', 'too_long');

  if (errors.length > 0 || !planned.ok) return { ok: false, errors };
  return { ok: true, value: { material, unit, plannedQty: planned.value, wastePct, phaseId, source, verifiedBy } };
}

// ---------------------------------------------------------------------------------------------------------------
// FR-MAT-02: a purchase against a line of the table. FR-FIN-03: it becomes ONE expense of qty × unit price.

export type PurchaseField = 'qty' | 'unitPrice' | 'supplier' | 'purchasedOn';
export interface PurchaseError {
  field: PurchaseField | 'total';
  code: QuantityErrorCode;
}

export interface PurchaseInput {
  qty?: string | null;
  unitPrice?: string | null;
  supplier?: string | null;
  /** "YYYY-MM-DD"; empty = today in Libya. */
  purchasedOn?: string | null;
}

export interface NewPurchase {
  qty: Decimal;
  unitPriceLyd: Money;
  supplier: string | null;
  /** null = today in Libya (the database's default). */
  purchasedOn: string | null;
  /** qty × unit price, the expense amount (FR-FIN-03). */
  totalLyd: Money;
}

/** @param today the date in Libya. A purchase already happened: its date is not after today. */
export function validatePurchase(input: PurchaseInput, today: string): { ok: true; value: NewPurchase } | { ok: false; errors: PurchaseError[] } {
  const errors: PurchaseError[] = [];
  const push = (field: PurchaseError['field'], code: QuantityErrorCode) => errors.push({ field, code });

  const qty = readQuantity(input.qty);
  if (!qty.ok) push('qty', qty.code);

  // A purchase costs money: 0 is refused (an expense must be positive, FR-FIN-02).
  const price = readMoneyInput(input.unitPrice);
  if (!price.ok) push('unitPrice', price.code);

  const supplier = clean(input.supplier) || null;
  if (supplier !== null && length(supplier) > SUPPLIER_MAX) push('supplier', 'too_long');

  const rawDate = (input.purchasedOn ?? '').trim();
  let purchasedOn: string | null = null;
  if (rawDate !== '') {
    if (!isIsoDate(rawDate)) push('purchasedOn', 'invalid_date');
    else if (rawDate > today) push('purchasedOn', 'date_in_future');
    else purchasedOn = rawDate;
  }

  if (errors.length > 0 || !qty.ok || !price.ok) return { ok: false, errors };
  const total = money(qty.value.times(price.value));
  if (total.gt(QTY_MAX)) return { ok: false, errors: [{ field: 'total', code: 'too_large' }] };
  if (total.lte(0)) return { ok: false, errors: [{ field: 'total', code: 'must_be_positive' }] };
  return { ok: true, value: { qty: qty.value, unitPriceLyd: price.value, supplier, purchasedOn, totalLyd: total } };
}

// ---------------------------------------------------------------------------------------------------------------
// FR-MAT-02 / FR-MAT-03: where a line stands.

export interface ItemProgress {
  plannedQty: Decimal;
  wastePct: Decimal;
  purchasedQty: Decimal;
  /** planned × (1 + waste %): what may be bought before the warning (FR-MAT-03). */
  allowedQty: Decimal;
  /** «المتبقي للشراء» = planned − purchased, never below 0 (FR-MAT-02). */
  remainingQty: Decimal;
  /** Purchases above the allowed quantity (FR-MAT-03: 5.8 of an allowed 5.5 warns, 5.4 does not). */
  isOver: boolean;
  /** How much above the allowed quantity, or 0. */
  overBy: Decimal;
}

export function itemProgress(plannedQty: Decimal.Value, wastePct: Decimal.Value, purchasedQtys: Decimal.Value[]): ItemProgress {
  const planned = new D(plannedQty);
  const waste = new D(wastePct);
  const purchased = purchasedQtys.reduce<Decimal>((sum, q) => sum.plus(new D(q)), new D(0));
  const allowed = planned.times(new D(100).plus(waste)).div(100).toDecimalPlaces(3);
  const remaining = Decimal.max(planned.minus(purchased), 0);
  const over = purchased.minus(allowed);
  return {
    plannedQty: planned,
    wastePct: waste,
    purchasedQty: purchased,
    allowedQty: allowed,
    remainingQty: remaining,
    isOver: over.gt(0),
    overBy: Decimal.max(over, 0),
  };
}

/** FR-MAT-03 before saving: would this purchase take the line above its allowed quantity? (decision D2: warn, ask) */
export function purchaseWouldExceed(progress: ItemProgress, qty: Decimal.Value): { exceeds: boolean; afterQty: Decimal; overBy: Decimal } {
  const after = progress.purchasedQty.plus(new D(qty));
  const over = after.minus(progress.allowedQty);
  return { exceeds: over.gt(0), afterQty: after, overBy: Decimal.max(over, 0) };
}
