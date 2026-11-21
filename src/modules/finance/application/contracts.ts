import { addMoney, isUuid, toDb, type Money } from '@/shared-kernel';
import {
  contractSummary,
  validateContract,
  validatePayment,
  type ContractError,
  type ContractInput,
  type ContractSummary,
  type PaymentError,
  type PaymentInput,
} from '../domain/contracts';
import type { ExpenseFailure } from './expense-gateway';

// Use cases: contracts and the payment schedule (FR-FIN-08, FR-FIN-09, UC-16; 3.16 contractual part, slice 1). Run on
// the server as the signed-in user, under RLS. The database audits every change and deletion (0031).

export interface ContractRecord {
  id: string;
  title: string;
  contractor: string;
  /** "90000.000" */
  valueLyd: string;
  scope: string | null;
  cleanupClause: string | null;
  /** A weak reference to a document of type «عقد» (documents is another module; the app checks it). */
  documentId: string | null;
  createdAt: string;
}

export interface PaymentRecord {
  id: string;
  contractId: string;
  title: string;
  amountLyd: string;
  retainedLyd: string;
  phaseId: string | null;
  /** "YYYY-MM-DD"; null until paid. */
  paidOn: string | null;
  /** The ONE expense the payment made (amount minus the retained part); null while unpaid, when the whole payment is retained, or after the owner deleted that expense. */
  expenseId: string | null;
  /** The key of the second expense (the release), made once with the row so a retry never makes two. */
  releaseOpId: string;
  /** "YYYY-MM-DD"; the day the retained part was released. */
  releasedOn: string | null;
  releaseExpenseId: string | null;
  createdAt: string;
}

export interface NewContractRecord {
  projectId: string;
  title: string;
  contractor: string;
  valueLyd: string;
  scope: string | null;
  cleanupClause: string | null;
  documentId: string | null;
}

export interface NewPaymentRecord {
  projectId: string;
  contractId: string;
  title: string;
  amountLyd: string;
  retainedLyd: string;
  phaseId: string | null;
}

export type StoreOutcome = { status: 'done' } | { status: 'failed'; reason: ExpenseFailure };

/** Port. The Supabase adapter is infra/supabase-contract-store.ts; tests use a fake. */
export interface ContractStore {
  /** Oldest first: the order the owner agreed them in. */
  listContracts(projectId: string): Promise<ContractRecord[]>;
  listPayments(projectId: string): Promise<PaymentRecord[]>;
  addContract(contract: NewContractRecord): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: ExpenseFailure }>;
  addPayment(payment: NewPaymentRecord): Promise<StoreOutcome>;
  removeContract(projectId: string, id: string): Promise<StoreOutcome>;
  removePayment(projectId: string, id: string): Promise<StoreOutcome>;
}

export type AddContractResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'invalid'; errors: ContractError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

export async function addContract(store: ContractStore, command: ContractInput & { projectId: string }): Promise<AddContractResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validateContract(command);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const v = valid.value;
  const outcome = await store.addContract({
    projectId: command.projectId.toLowerCase(),
    title: v.title,
    contractor: v.contractor,
    valueLyd: toDb(v.valueLyd),
    scope: v.scope,
    cleanupClause: v.cleanupClause,
    documentId: v.documentId,
  });
  return outcome.status === 'done' ? { ok: true, id: outcome.id } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export type AddPaymentResult =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: PaymentError[] }
  | { ok: false; kind: 'failed'; reason: ExpenseFailure };

export async function addPayment(store: ContractStore, command: PaymentInput & { projectId: string; contractId: string }): Promise<AddPaymentResult> {
  if (!isUuid(command.projectId) || !isUuid(command.contractId)) return { ok: false, kind: 'failed', reason: 'not_found' };
  const valid = validatePayment(command);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const v = valid.value;
  const outcome = await store.addPayment({
    projectId: command.projectId.toLowerCase(),
    contractId: command.contractId.toLowerCase(),
    title: v.title,
    amountLyd: toDb(v.amountLyd),
    retainedLyd: toDb(v.retainedLyd),
    phaseId: v.phaseId,
  });
  return outcome.status === 'done' ? { ok: true } : { ok: false, kind: 'failed', reason: outcome.reason };
}

/** Deleting a contract deletes its payments (the database cascades); both stay in the audit log with their old values. */
export async function removeContract(store: ContractStore, command: { projectId: string; id: string }): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id)) return { ok: false, reason: 'not_found' };
  const outcome = await store.removeContract(command.projectId.toLowerCase(), command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export async function removePayment(store: ContractStore, command: { projectId: string; id: string }): Promise<{ ok: true } | { ok: false; reason: ExpenseFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id)) return { ok: false, reason: 'not_found' };
  const outcome = await store.removePayment(command.projectId.toLowerCase(), command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export interface ContractRow extends ContractRecord {
  summary: ContractSummary;
  /** How many installments the schedule has. */
  paymentCount: number;
}

export interface ContractsView {
  /** In the order they were made. */
  contracts: ContractRow[];
  /** The sum of the contract values. */
  totalValue: Money;
}

function rowOf(contract: ContractRecord, payments: PaymentRecord[]): ContractRow {
  const own = payments.filter((p) => p.contractId === contract.id);
  return { ...contract, summary: contractSummary({ value: contract.valueLyd, payments: own }), paymentCount: own.length };
}

/** S17.1: every contract of the project with its figures. */
export async function getContracts(store: ContractStore, projectId: string): Promise<ContractsView> {
  const [contracts, payments] = await Promise.all([store.listContracts(projectId), store.listPayments(projectId)]);
  return { contracts: contracts.map((c) => rowOf(c, payments)), totalValue: addMoney('0', ...contracts.map((c) => c.valueLyd)) };
}

export interface ContractDetail {
  contract: ContractRow;
  /** The schedule, in the order the owner agreed it. */
  payments: PaymentRecord[];
}

/** S17.2: one contract with its schedule; null when it is not found (or not visible to this user). */
export async function getContract(store: ContractStore, projectId: string, id: string): Promise<ContractDetail | null> {
  if (!isUuid(id)) return null;
  const [contracts, payments] = await Promise.all([store.listContracts(projectId), store.listPayments(projectId)]);
  const contract = contracts.find((c) => c.id === id.toLowerCase());
  if (!contract) return null;
  return { contract: rowOf(contract, payments), payments: payments.filter((p) => p.contractId === contract.id) };
}
