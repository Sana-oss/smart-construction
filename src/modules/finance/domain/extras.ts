import { addMoney, isIsoDate, isUuid, money, readMoneyInput, subMoney, type Money, type MoneyInput, type MoneyInputError } from '@/shared-kernel';

// Extra works and changes (FR-FIN-10, UC-17; 3.16 financial part, slice 2; owner's decisions of 20 Nov 2026, change
// register). Pure: no React, no database. Money is Decimal.
//   - An extra work is proposed, approved or rejected. Rejected ones change nothing (FR-FIN-10).
//   - Approved ones are taken from the contingency first; past it, the expected cost goes above the budget, and the
//     contingency is «used up» (FR-FIN-11's second warning). Proposed ones are shown apart and counted nowhere.
//   - No contract yet: contracts are priority 2. An extra work may be linked to one later.

export const EXTRA_STATUSES = ['proposed', 'approved', 'rejected'] as const;
export type ExtraStatus = (typeof EXTRA_STATUSES)[number];
export const isExtraStatus = (v: unknown): v is ExtraStatus => (EXTRA_STATUSES as readonly unknown[]).includes(v);

/** Project decisions (20 Nov 2026), like the other text fields. */
export const EXTRA_TITLE_MIN = 2;
export const EXTRA_TITLE_MAX = 80;
export const EXTRA_NOTE_MAX = 200;

export type ExtraField = 'title' | 'cost' | 'occurredOn' | 'phaseId' | 'contractId' | 'status' | 'note';
export type ExtraErrorCode = MoneyInputError | 'too_short' | 'too_long' | 'invalid_date' | 'date_in_future' | 'invalid_id' | 'unknown_choice';
export interface ExtraError {
  field: ExtraField;
  code: ExtraErrorCode;
}

export interface ExtraInput {
  /** What the work is, e.g. «توسيع الشرفة». */
  title?: string | null;
  cost?: string | null;
  /** When it was proposed or agreed. Empty = today in Libya. */
  occurredOn?: string | null;
  phaseId?: string | null;
  /** The contract the work belongs to (optional; the contracts screens, 3.16). */
  contractId?: string | null;
  /** Empty = proposed. */
  status?: string | null;
  note?: string | null;
}

export interface NewExtra {
  title: string;
  costLyd: Money;
  /** null = today in Libya (the database's default). */
  occurredOn: string | null;
  phaseId: string | null;
  contractId: string | null;
  status: ExtraStatus;
  note: string | null;
}

const clean = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ');
const length = (s: string) => [...s].length;

/** @param today the date in Libya: an extra work is one already proposed or agreed, not a future one. */
export function validateExtra(input: ExtraInput, today: string): { ok: true; value: NewExtra } | { ok: false; errors: ExtraError[] } {
  const errors: ExtraError[] = [];
  const title = clean(input.title);
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if (length(title) < EXTRA_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if (length(title) > EXTRA_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  const cost = readMoneyInput(input.cost);
  if (!cost.ok) errors.push({ field: 'cost', code: cost.code });

  let occurredOn: string | null = null;
  const date = clean(input.occurredOn);
  if (date !== '') {
    if (!isIsoDate(date)) errors.push({ field: 'occurredOn', code: 'invalid_date' });
    else if (date > today) errors.push({ field: 'occurredOn', code: 'date_in_future' });
    else occurredOn = date;
  }

  let phaseId: string | null = null;
  const phase = clean(input.phaseId).toLowerCase();
  if (phase !== '') {
    if (isUuid(phase)) phaseId = phase;
    else errors.push({ field: 'phaseId', code: 'invalid_id' });
  }

  let contractId: string | null = null;
  const contract = clean(input.contractId).toLowerCase();
  if (contract !== '') {
    if (isUuid(contract)) contractId = contract;
    else errors.push({ field: 'contractId', code: 'invalid_id' });
  }

  const statusRaw = clean(input.status);
  const status: ExtraStatus | null = statusRaw === '' ? 'proposed' : isExtraStatus(statusRaw) ? statusRaw : null;
  if (status === null) errors.push({ field: 'status', code: 'unknown_choice' });

  const note = clean(input.note) || null;
  if (note !== null && length(note) > EXTRA_NOTE_MAX) errors.push({ field: 'note', code: 'too_long' });

  if (errors.length > 0 || !cost.ok || status === null) return { ok: false, errors };
  return { ok: true, value: { title, costLyd: cost.value, occurredOn, phaseId, contractId, status, note } };
}

export interface ContingencyUse {
  /** Sum of the approved extra works. */
  approved: Money;
  /** Sum of the proposed ones: shown apart, counted nowhere. */
  proposed: Money;
  /** The contingency left after the approved works (never below zero). */
  contingencyLeft: Money;
  /** What the approved works take beyond the contingency (zero while it is enough). */
  beyondContingency: Money;
  /** FR-FIN-11: the approved works used the whole contingency (and maybe more). */
  usedUp: boolean;
  /** FR-FIN-10: the budget plus what the approved works take beyond the contingency. */
  expectedTotal: Money;
}

/** FR-FIN-10, owner's decision 2 of 20 Nov 2026: approved extra works come out of the contingency first. */
export function contingencyUse(input: {
  total: MoneyInput;
  contingency: MoneyInput;
  extras: readonly { status: ExtraStatus; costLyd: MoneyInput }[];
}): ContingencyUse {
  const sum = (s: ExtraStatus) => addMoney('0', ...input.extras.filter((e) => e.status === s).map((e) => e.costLyd));
  const approved = sum('approved');
  const contingency = money(input.contingency);
  const left = subMoney(contingency, approved);
  const beyond = left.isNegative() ? left.negated() : money('0');
  return {
    approved,
    proposed: sum('proposed'),
    contingencyLeft: left.isNegative() ? money('0') : left,
    beyondContingency: beyond,
    usedUp: approved.gt(0) && approved.gte(contingency),
    expectedTotal: addMoney(input.total, beyond),
  };
}

export interface ContractExtras {
  /** Sum of the approved extra works linked to the contract. */
  approved: Money;
  /** Sum of the proposed ones: shown apart, counted nowhere. */
  proposed: Money;
  approvedCount: number;
  proposedCount: number;
}

/**
 * Extra works linked to a contract (3.16, owner's decision of 21 Nov 2026): shown on the contract page and nowhere in its
 * numbers. The contract value and what is left to pay do not change, and the budget already counts the approved works
 * through the contingency (contingencyUse), so nothing is counted twice. Rejected works are not shown here.
 */
export function contractExtras(extras: readonly { status: ExtraStatus; costLyd: MoneyInput }[]): ContractExtras {
  const of = (s: ExtraStatus) => extras.filter((e) => e.status === s);
  return {
    approved: addMoney('0', ...of('approved').map((e) => e.costLyd)),
    proposed: addMoney('0', ...of('proposed').map((e) => e.costLyd)),
    approvedCount: of('approved').length,
    proposedCount: of('proposed').length,
  };
}
