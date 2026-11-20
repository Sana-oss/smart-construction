import Decimal from 'decimal.js';
import { isUuid, toDb, type PurchaseRecordedPayload } from '@/shared-kernel';
import {
  itemProgress,
  purchaseWouldExceed,
  validateItem,
  validatePurchase,
  type ItemError,
  type ItemInput,
  type ItemProgress,
  type PurchaseError,
  type PurchaseInput,
} from '../domain/quantities';

// Use cases: the quantity table and purchases (3.3 slice 2; FR-MAT-01, FR-MAT-02, FR-MAT-03; design S20.1, S20.2,
// S21.1). Run on the server as the signed-in user, under RLS. The database audits every change and deletion (0024).
// Recording a purchase returns its purchase.recorded event: the app hands it to finance, which makes the expense.

export interface ItemRecord {
  id: string;
  material: string;
  unit: string;
  /** Canonical decimal strings. */
  plannedQty: string;
  wastePct: string;
  phaseId: string | null;
  source: string | null;
  verifiedBy: string | null;
}

export interface PurchaseRecord {
  id: string;
  itemId: string;
  qty: string;
  unitPriceLyd: string;
  supplier: string | null;
  purchasedOn: string;
  /** The expense finance made from it (weak reference), or null while it is still missing. */
  expenseRef: string | null;
  createdAt: string;
}

export type QuantityFailure =
  | 'not_allowed' // not signed in, or no write access to this project
  | 'duplicate' // the same material, unit and phase is already in the table
  | 'unknown_reference' // the phase or the line does not belong to this project
  | 'has_purchases' // a line with purchases cannot be deleted
  | 'rejected' // the database refused the values (its own check of the domain rules)
  | 'not_found'
  | 'unavailable';

export interface NewPurchaseRecord {
  projectId: string;
  itemId: string;
  qty: string;
  unitPriceLyd: string;
  supplier: string | null;
  purchasedOn: string | null;
  clientOpId: string;
  overAllowanceConfirmed: boolean;
}

/** Port. The Supabase adapter is infra/supabase-quantity-store.ts; tests use a fake. */
export interface QuantityStore {
  listItems(projectId: string): Promise<ItemRecord[]>;
  listPurchases(projectId: string): Promise<PurchaseRecord[]>;
  addItem(projectId: string, item: Omit<ItemRecord, 'id'>): Promise<{ status: 'done'; id: string } | { status: 'failed'; reason: QuantityFailure }>;
  deleteItem(projectId: string, itemId: string): Promise<{ status: 'done' } | { status: 'failed'; reason: QuantityFailure }>;
  /** record_purchase (0024): the purchase and its event in one transaction; idempotent on clientOpId. */
  recordPurchase(p: NewPurchaseRecord): Promise<{ status: 'done'; purchaseId: string; created: boolean } | { status: 'failed'; reason: QuantityFailure }>;
  /** Sets the weak reference to finance's expense (once). */
  linkExpense(projectId: string, purchaseId: string, expenseId: string): Promise<{ status: 'done' } | { status: 'failed'; reason: QuantityFailure }>;
}

// ---------------------------------------------------------------------------------------------------------------
// Reads

export interface ItemWithProgress {
  item: ItemRecord;
  progress: ItemProgress;
}

export interface QuantityTable {
  /** In the order the owner added them would need a timestamp; by material is what the owner scans for. */
  items: ItemWithProgress[];
  /** Lines bought past their allowed quantity (FR-MAT-03). */
  overCount: number;
  /** Purchases whose expense is still missing (the dispatch failed): the screen offers to finish them. */
  pendingExpenses: number;
}

export async function getQuantityTable(store: QuantityStore, projectId: string): Promise<QuantityTable> {
  const [items, purchases] = await Promise.all([store.listItems(projectId), store.listPurchases(projectId)]);
  const rows = items
    .map((item) => ({
      item,
      progress: itemProgress(item.plannedQty, item.wastePct, purchases.filter((p) => p.itemId === item.id).map((p) => p.qty)),
    }))
    .sort((a, b) => a.item.material.localeCompare(b.item.material, 'ar'));
  return {
    items: rows,
    overCount: rows.filter((r) => r.progress.isOver).length,
    pendingExpenses: purchases.filter((p) => p.expenseRef === null).length,
  };
}

export interface ItemDetail extends ItemWithProgress {
  /** Newest first. */
  purchases: PurchaseRecord[];
}

/** Design S20.2. null = not in this project (or not visible to this user). */
export async function getItemDetail(store: QuantityStore, projectId: string, itemId: string): Promise<ItemDetail | null> {
  if (!isUuid(itemId)) return null;
  const [items, purchases] = await Promise.all([store.listItems(projectId), store.listPurchases(projectId)]);
  const item = items.find((i) => i.id === itemId.toLowerCase());
  if (!item) return null;
  const mine = purchases
    .filter((p) => p.itemId === item.id)
    .sort((a, b) => (a.purchasedOn === b.purchasedOn ? b.createdAt.localeCompare(a.createdAt) : b.purchasedOn.localeCompare(a.purchasedOn)));
  return { item, progress: itemProgress(item.plannedQty, item.wastePct, mine.map((p) => p.qty)), purchases: mine };
}

// ---------------------------------------------------------------------------------------------------------------
// Writes

export type AddItemResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'invalid'; errors: ItemError[] }
  | { ok: false; kind: 'failed'; reason: QuantityFailure };

/** FR-MAT-01. */
export async function addItem(store: QuantityStore, projectId: string, input: ItemInput): Promise<AddItemResult> {
  const v = validateItem(input);
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };
  const r = await store.addItem(projectId, {
    material: v.value.material,
    unit: v.value.unit,
    plannedQty: v.value.plannedQty.toFixed(3),
    wastePct: v.value.wastePct.toFixed(2),
    phaseId: v.value.phaseId,
    source: v.value.source,
    verifiedBy: v.value.verifiedBy,
  });
  return r.status === 'done' ? { ok: true, id: r.id } : { ok: false, kind: 'failed', reason: r.reason };
}

export async function deleteItem(store: QuantityStore, projectId: string, itemId: string) {
  if (!isUuid(itemId)) return { status: 'failed' as const, reason: 'not_found' as const };
  return store.deleteItem(projectId, itemId);
}

export interface PurchaseCommand extends PurchaseInput {
  /** Made once by the page for each purchase form (crypto.randomUUID): a resent form records nothing new. */
  clientOpId?: string | null;
  /** The owner saw the over-allowance warning and confirmed (decision D2). */
  overAllowanceConfirmed?: boolean;
}

export type RecordPurchaseResult =
  /** event: to hand to finance (FR-FIN-03). duplicate = this exact form was saved before. */
  | { ok: true; purchaseId: string; duplicate: boolean; event: PurchaseRecordedPayload }
  | { ok: false; kind: 'invalid'; errors: PurchaseError[] }
  /** FR-MAT-03 / D2: the purchase would take the line above its allowed quantity; ask before saving. */
  | { ok: false; kind: 'needs_confirmation'; allowedQty: Decimal; afterQty: Decimal; overBy: Decimal }
  | { ok: false; kind: 'failed'; reason: QuantityFailure };

/** FR-MAT-02 (design S21.1). @param today the date in Libya. */
export async function recordPurchase(
  store: QuantityStore,
  projectId: string,
  itemId: string,
  command: PurchaseCommand,
  today: string,
): Promise<RecordPurchaseResult> {
  if (!isUuid(command.clientOpId)) return { ok: false, kind: 'failed', reason: 'rejected' };
  const v = validatePurchase(command, today);
  if (!v.ok) return { ok: false, kind: 'invalid', errors: v.errors };

  const detail = await getItemDetail(store, projectId, itemId);
  if (!detail) return { ok: false, kind: 'failed', reason: 'unknown_reference' };
  const check = purchaseWouldExceed(detail.progress, v.value.qty);
  if (check.exceeds && !command.overAllowanceConfirmed) {
    return { ok: false, kind: 'needs_confirmation', allowedQty: detail.progress.allowedQty, afterQty: check.afterQty, overBy: check.overBy };
  }

  const qty = v.value.qty.toFixed(3);
  const unitPriceLyd = toDb(v.value.unitPriceLyd);
  const r = await store.recordPurchase({
    projectId,
    itemId: detail.item.id,
    qty,
    unitPriceLyd,
    supplier: v.value.supplier,
    purchasedOn: v.value.purchasedOn,
    clientOpId: command.clientOpId!.toLowerCase(),
    overAllowanceConfirmed: check.exceeds,
  });
  if (r.status === 'failed') return { ok: false, kind: 'failed', reason: r.reason };
  return {
    ok: true,
    purchaseId: r.purchaseId,
    duplicate: !r.created,
    event: {
      purchaseId: r.purchaseId,
      material: detail.item.material,
      unit: detail.item.unit,
      phaseId: detail.item.phaseId,
      qty,
      unitPriceLyd,
      supplier: v.value.supplier,
      purchasedOn: v.value.purchasedOn ?? today,
    },
  };
}

/**
 * The purchase.recorded event of a stored purchase whose expense is still missing (the first dispatch failed), so
 * the owner can finish it. null = not found, or its expense already exists (nothing to do).
 */
export async function pendingPurchaseEvent(store: QuantityStore, projectId: string, purchaseId: string): Promise<PurchaseRecordedPayload | null> {
  if (!isUuid(purchaseId)) return null;
  const [items, purchases] = await Promise.all([store.listItems(projectId), store.listPurchases(projectId)]);
  const p = purchases.find((x) => x.id === purchaseId.toLowerCase());
  const item = p && items.find((i) => i.id === p.itemId);
  if (!p || !item || p.expenseRef !== null) return null;
  return {
    purchaseId: p.id,
    material: item.material,
    unit: item.unit,
    phaseId: item.phaseId,
    qty: p.qty,
    unitPriceLyd: p.unitPriceLyd,
    supplier: p.supplier,
    purchasedOn: p.purchasedOn,
  };
}
