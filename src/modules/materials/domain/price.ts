import { isIsoDate, readMoneyInput, type Money, type MoneyInputError } from '@/shared-kernel';

// The owner's price log and supplier quotes (FR-MAT-08, FR-MAT-10; design S24.1 «سجل الأسعار», S24.2 «تاريخ سعر …»,
// S24.3 «إضافة سعر»; slice 2 of 3.7). Pure: no React, no database. Prices are what the OWNER paid or was offered;
// the app never forecasts a price (3.10: no reliable history exists).

/** «سعر مدفوع» (what the owner paid) or «عرض مورد» (a supplier's quote, which may expire). */
export const PRICE_KINDS = ['paid', 'quote'] as const;
export type PriceKind = (typeof PRICE_KINDS)[number];

/** FR-MAT-10: warn this many days before a quote expires. */
export const QUOTE_WARNING_DAYS = 7;

/** Project decisions (19 Nov 2026), like the other text fields. */
export const MATERIAL_MIN = 2;
export const MATERIAL_MAX = 60;
export const UNIT_MAX = 20;
export const SUPPLIER_MAX = 80;
export const PRICE_NOTE_MAX = 200;

export type PriceField = 'material' | 'unit' | 'price' | 'kind' | 'supplier' | 'recordedOn' | 'expiresOn' | 'transport' | 'note';
export type PriceErrorCode =
  | MoneyInputError
  | 'too_short'
  | 'too_long'
  | 'unknown_choice'
  | 'invalid_date'
  | 'date_in_future'
  | 'expiry_before_date'
  | 'expiry_only_for_quote';
export interface PriceError {
  field: PriceField;
  code: PriceErrorCode;
}

/** What the S24.3 form sends, as typed. */
export interface PriceInput {
  material?: string | null;
  unit?: string | null;
  price?: string | null;
  kind?: string | null;
  supplier?: string | null;
  /** «التاريخ»: when the price was paid or the quote received. Empty = today in Libya. */
  recordedOn?: string | null;
  /** «صالح حتى» (quotes only, optional). */
  expiresOn?: string | null;
  /** «تكلفة النقل» (optional, may be 0). */
  transport?: string | null;
  note?: string | null;
}

export interface NewPrice {
  material: string;
  unit: string;
  priceLyd: Money;
  kind: PriceKind;
  supplier: string | null;
  /** null = today in Libya (the database's default). */
  recordedOn: string | null;
  expiresOn: string | null;
  transportLyd: Money | null;
  note: string | null;
}

export type PriceValidation = { ok: true; value: NewPrice } | { ok: false; errors: PriceError[] };

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

/** @param today the date in Libya, "YYYY-MM-DD". A price or a quote is something that already happened. */
export function validatePrice(input: PriceInput, today: string): PriceValidation {
  const errors: PriceError[] = [];
  const push = (field: PriceField, code: PriceErrorCode) => errors.push({ field, code });

  const material = clean(input.material);
  if (material === '') push('material', 'required');
  else if (length(material) < MATERIAL_MIN) push('material', 'too_short');
  else if (length(material) > MATERIAL_MAX) push('material', 'too_long');

  const unit = clean(input.unit);
  if (unit === '') push('unit', 'required');
  else if (length(unit) > UNIT_MAX) push('unit', 'too_long');

  const price = readMoneyInput(input.price, { allowZero: true }); // FR-MAT-08: «السعر غير سالب»
  if (!price.ok) push('price', price.code);

  const kind = clean(input.kind);
  if (kind === '') push('kind', 'required');
  else if (!(PRICE_KINDS as readonly string[]).includes(kind)) push('kind', 'unknown_choice');

  const supplier = clean(input.supplier) || null;
  if (supplier !== null && length(supplier) > SUPPLIER_MAX) push('supplier', 'too_long');

  let recordedOn: string | null = null;
  const date = clean(input.recordedOn);
  if (date !== '') {
    if (!isIsoDate(date)) push('recordedOn', 'invalid_date');
    else if (date > today) push('recordedOn', 'date_in_future');
    else recordedOn = date;
  }

  let expiresOn: string | null = null;
  const expiry = clean(input.expiresOn);
  if (expiry !== '') {
    if (kind !== 'quote') push('expiresOn', 'expiry_only_for_quote');
    else if (!isIsoDate(expiry)) push('expiresOn', 'invalid_date');
    else if (expiry < (recordedOn ?? today)) push('expiresOn', 'expiry_before_date');
    else expiresOn = expiry;
  }

  let transportLyd: Money | null = null;
  if (clean(input.transport) !== '') {
    const t = readMoneyInput(input.transport, { allowZero: true });
    if (t.ok) transportLyd = t.value;
    else push('transport', t.code);
  }

  const note = clean(input.note) || null;
  if (note !== null && length(note) > PRICE_NOTE_MAX) push('note', 'too_long');

  if (errors.length > 0 || !price.ok) return { ok: false, errors };
  return {
    ok: true,
    value: { material, unit, priceLyd: price.value, kind: kind as PriceKind, supplier, recordedOn, expiresOn, transportLyd, note },
  };
}

/** One stored price, as the screens read it. Money stays a decimal string. */
export interface PriceRecord {
  id: string;
  material: string;
  unit: string;
  priceLyd: string;
  kind: PriceKind;
  supplier: string | null;
  recordedOn: string;
  expiresOn: string | null;
  transportLyd: string | null;
  note: string | null;
  /** ISO timestamp; orders two prices of the same day. */
  createdAt: string;
}

/**
 * Prices of the same material and unit belong together, whatever the spacing or Latin letter case
 * («حديد  التسليح / طن» = «حديد التسليح / طن»). Different units stay apart: a ton and a kilo are not comparable.
 */
export function materialKey(material: string, unit: string): string {
  return `${clean(material).toLowerCase()}|${clean(unit).toLowerCase()}`;
}

export type QuoteStatus =
  /** A price the owner paid: it does not expire. */
  | { kind: 'paid' }
  | { kind: 'open' }
  /** FR-MAT-10: expires within QUOTE_WARNING_DAYS (0 = expires today). */
  | { kind: 'expiring'; daysLeft: number }
  /** FR-DEC-03: marked, and never used silently in a calculation. */
  | { kind: 'expired' };

const days = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);

export function quoteStatus(p: { kind: PriceKind; expiresOn: string | null }, today: string): QuoteStatus {
  if (p.kind === 'paid') return { kind: 'paid' };
  if (p.expiresOn === null) return { kind: 'open' };
  if (p.expiresOn < today) return { kind: 'expired' };
  const left = days(today, p.expiresOn);
  return left <= QUOTE_WARNING_DAYS ? { kind: 'expiring', daysLeft: left } : { kind: 'open' };
}

/** Newest first: by date, then by when it was recorded. */
export const newestFirst = (a: PriceRecord, b: PriceRecord) =>
  a.recordedOn === b.recordedOn ? b.createdAt.localeCompare(a.createdAt) : a.recordedOn < b.recordedOn ? 1 : -1;

export interface MaterialPrices {
  key: string;
  /** As the owner typed it in the newest record. */
  material: string;
  unit: string;
  latest: PriceRecord;
  count: number;
}

/** S24.1: one row per material and unit, with its latest price; the most recently updated first. */
export function latestPrices(records: readonly PriceRecord[]): MaterialPrices[] {
  const groups = new Map<string, PriceRecord[]>();
  for (const r of records) {
    const k = materialKey(r.material, r.unit);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.entries()]
    .map(([key, rows]) => {
      const sorted = [...rows].sort(newestFirst);
      return { key, material: sorted[0].material, unit: sorted[0].unit, latest: sorted[0], count: rows.length };
    })
    .sort((a, b) => newestFirst(a.latest, b.latest));
}

/** S24.2: every price of one material and unit, newest first. */
export function priceHistory(records: readonly PriceRecord[], material: string, unit: string): PriceRecord[] {
  const key = materialKey(material, unit);
  return records.filter((r) => materialKey(r.material, r.unit) === key).sort(newestFirst);
}

/** FR-DEC-03: a material whose latest price is older than this is «قديم» (owner's decision of 20 Nov 2026). */
export const STALE_PRICE_DAYS = 30;

export interface PriceWarnings {
  /** Materials whose latest price is older than STALE_PRICE_DAYS. */
  stale: { material: string; unit: string; recordedOn: string }[];
  /** Expired quotes (any, not only the latest): never used silently. */
  expired: { material: string; unit: string; expiresOn: string }[];
}

/** For the continue-or-pause comparison (3.7): what in the price log should not be trusted as it is. */
export function priceWarnings(records: readonly PriceRecord[], today: string): PriceWarnings {
  return {
    stale: latestPrices(records)
      .filter((g) => days(g.latest.recordedOn, today) > STALE_PRICE_DAYS)
      .map((g) => ({ material: g.material, unit: g.unit, recordedOn: g.latest.recordedOn })),
    expired: records
      .filter((r) => quoteStatus(r, today).kind === 'expired')
      .sort(newestFirst)
      .map((r) => ({ material: r.material, unit: r.unit, expiresOn: r.expiresOn! })),
  };
}
