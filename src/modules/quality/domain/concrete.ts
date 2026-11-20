import Decimal from 'decimal.js';
import { isIsoDate, isUuid, parseDecimalInput } from '@/shared-kernel';

// The concrete log (3.13; FR-QLT-04, FR-QLT-05; design S27.1 «سجل الخرسانة», S27.2 «تسجيل صبة»). Pure: no React, no
// database.
//
// Engineering content: how long to cure and when to remove the formwork are the ENGINEER's. The app holds no number of
// days anywhere: the owner copies the engineer's two dates for each pour, and the app only reminds on those dates
// (owner's decision of 20 Nov 2026). REMINDER_WINDOW_DAYS is a display window, not an engineering value.

/** A reminder shows this many days before its date, and stays (as late) until it is marked done. */
export const REMINDER_WINDOW_DAYS = 2;

/** Project decisions (20 Nov 2026), like the other text fields. */
export const POUR_TEXT_MIN = 2;
export const POUR_ELEMENT_MAX = 80;
export const POUR_SUPPLIER_MAX = 80;
export const POUR_MIX_REF_MAX = 80;
export const POUR_DELIVERY_REF_MAX = 40;
export const POUR_NOTE_MAX = 200;
export const CUBE_SAMPLES_MAX = 1000;
/** numeric(10,3): at most 7 digits before the point. */
const QTY_MAX = new Decimal('9999999.999');

export type PourField =
  | 'element'
  | 'pouredOn'
  | 'supplier'
  | 'qtyM3'
  | 'cubeSamples'
  | 'mixRef'
  | 'deliveryRef'
  | 'phaseId'
  | 'curingUntil'
  | 'formworkOn'
  | 'note'
  | 'clientOpId';
export type PourErrorCode =
  | 'required'
  | 'too_short'
  | 'too_long'
  | 'invalid_number'
  | 'must_be_positive'
  | 'too_large'
  | 'too_many_decimals'
  | 'must_be_whole'
  | 'invalid_date'
  | 'date_in_future'
  | 'before_pour'
  | 'invalid_reference';
export interface PourError {
  field: PourField;
  code: PourErrorCode;
}

/** What the S27.2 form sends, as typed. */
export interface PourInput {
  /** «عنصر الصب», e.g. «سقف الدور الأرضي» (stored in 0002's location column). */
  element?: string | null;
  pouredOn?: string | null;
  supplier?: string | null;
  qtyM3?: string | null;
  cubeSamples?: string | null;
  /** «مرجع الخلطة المعتمدة». */
  mixRef?: string | null;
  /** «رقم إذن التوريد». */
  deliveryRef?: string | null;
  phaseId?: string | null;
  /** The engineer's last day of water curing, copied by the owner (FR-QLT-05). */
  curingUntil?: string | null;
  /** The engineer's formwork-removal date, copied by the owner (FR-QLT-05). */
  formworkOn?: string | null;
  note?: string | null;
  /** Made once by the page: a resent form records nothing new (0002's client_op_id). */
  clientOpId?: string | null;
}

export interface NewPour {
  element: string;
  pouredOn: string;
  supplier: string;
  qtyM3: Decimal;
  cubeSamples: number;
  mixRef: string | null;
  deliveryRef: string | null;
  phaseId: string | null;
  curingUntil: string | null;
  formworkOn: string | null;
  note: string | null;
  clientOpId: string;
}

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

/**
 * FR-QLT-04: «لا يُسجَّل صبّ بلا تاريخ ومورد وكمية». @param today the date in Libya: a pour already happened; the two
 * reminder dates are planned, so they may be later, but never before the pour.
 */
export function validatePour(
  input: PourInput,
  today: string,
  isKnownPhase: (id: string) => boolean,
): { ok: true; value: NewPour } | { ok: false; errors: PourError[] } {
  const errors: PourError[] = [];
  const push = (field: PourField, code: PourErrorCode) => errors.push({ field, code });

  const required = (field: PourField, raw: string | null | undefined, max: number) => {
    const v = clean(raw);
    if (v === '') push(field, 'required');
    else if (length(v) < POUR_TEXT_MIN) push(field, 'too_short');
    else if (length(v) > max) push(field, 'too_long');
    return v;
  };
  const optional = (field: PourField, raw: string | null | undefined, max: number) => {
    const v = clean(raw) || null;
    if (v !== null && length(v) > max) push(field, 'too_long');
    return v;
  };

  const element = required('element', input.element, POUR_ELEMENT_MAX);

  const pouredOn = (input.pouredOn ?? '').trim();
  if (pouredOn === '') push('pouredOn', 'required');
  else if (!isIsoDate(pouredOn)) push('pouredOn', 'invalid_date');
  else if (pouredOn > today) push('pouredOn', 'date_in_future');

  const supplier = required('supplier', input.supplier, POUR_SUPPLIER_MAX);

  let qtyM3: Decimal | null = null;
  if ((input.qtyM3 ?? '').trim() === '') push('qtyM3', 'required');
  else {
    const parsed = parseDecimalInput(input.qtyM3);
    if (parsed === null) push('qtyM3', 'invalid_number');
    else if ((parsed.split('.')[1] ?? '').length > 3) push('qtyM3', 'too_many_decimals');
    else if (new Decimal(parsed).lte(0)) push('qtyM3', 'must_be_positive');
    else if (new Decimal(parsed).gt(QTY_MAX)) push('qtyM3', 'too_large');
    else qtyM3 = new Decimal(parsed);
  }

  let cubeSamples = 0;
  if ((input.cubeSamples ?? '').trim() !== '') {
    const parsed = parseDecimalInput(input.cubeSamples);
    if (parsed === null) push('cubeSamples', 'invalid_number');
    else if (parsed.includes('.')) push('cubeSamples', 'must_be_whole');
    else if (Number(parsed) > CUBE_SAMPLES_MAX) push('cubeSamples', 'too_large');
    else cubeSamples = Number(parsed);
  }

  const mixRef = optional('mixRef', input.mixRef, POUR_MIX_REF_MAX);
  const deliveryRef = optional('deliveryRef', input.deliveryRef, POUR_DELIVERY_REF_MAX);
  const note = optional('note', input.note, POUR_NOTE_MAX);

  const phaseId = clean(input.phaseId).toLowerCase() || null;
  if (phaseId !== null && !isKnownPhase(phaseId)) push('phaseId', 'invalid_reference');

  const reminderDate = (field: 'curingUntil' | 'formworkOn', raw: string | null | undefined) => {
    const v = (raw ?? '').trim() || null;
    if (v === null) return null;
    if (!isIsoDate(v)) push(field, 'invalid_date');
    else if (isIsoDate(pouredOn) && v < pouredOn) push(field, 'before_pour');
    return v;
  };
  const curingUntil = reminderDate('curingUntil', input.curingUntil);
  const formworkOn = reminderDate('formworkOn', input.formworkOn);

  const clientOpId = clean(input.clientOpId).toLowerCase();
  if (!isUuid(clientOpId)) push('clientOpId', 'required');

  if (errors.length > 0 || qtyM3 === null) return { ok: false, errors };
  return {
    ok: true,
    value: { element, pouredOn, supplier, qtyM3, cubeSamples, mixRef, deliveryRef, phaseId, curingUntil, formworkOn, note, clientOpId },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// FR-QLT-05: reminders on the engineer's dates.

export type ReminderKind = 'curing' | 'formwork';
export interface Reminder {
  pourId: string;
  element: string;
  kind: ReminderKind;
  date: string;
  /** Days from today to the date: negative = late, 0 = today. */
  days: number;
}

const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** The reminders to show today: from REMINDER_WINDOW_DAYS before the date until marked done. Most urgent first. */
export function dueReminders(
  pours: { id: string; element: string; curingUntil: string | null; curingDone: boolean; formworkOn: string | null; formworkDone: boolean }[],
  today: string,
): Reminder[] {
  const out: Reminder[] = [];
  for (const p of pours) {
    const add = (kind: ReminderKind, date: string | null, done: boolean) => {
      if (!date || done) return;
      const days = daysBetween(today, date);
      if (days <= REMINDER_WINDOW_DAYS) out.push({ pourId: p.id, element: p.element, kind, date, days });
    };
    add('curing', p.curingUntil, p.curingDone);
    add('formwork', p.formworkOn, p.formworkDone);
  }
  return out.sort((a, b) => a.days - b.days || a.element.localeCompare(b.element, 'ar'));
}

/** S27.1's summary: the total quantity recorded (m³) and the number of pours. */
export function pourTotals(pours: { qtyM3: string }[]): { totalM3: Decimal; count: number } {
  return { totalM3: pours.reduce((s, p) => s.plus(new Decimal(p.qtyM3)), new Decimal(0)), count: pours.length };
}
