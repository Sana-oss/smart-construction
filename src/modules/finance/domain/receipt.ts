import { isUuid } from '@/shared-kernel';

// Receipt photo on an expense (UC-07 "مصروف سريع ... وصورة فاتورة"; FR-DOC-02). Optional: the quick expense keeps
// its three required answers (NFR-USE-03). The photo is compressed in the browser like site photos (shared rules in
// shared-kernel/images.ts) and stored in the private bucket of 0013 under the project's folder. Pure.

/** "<project id>/receipts/<id>.jpg". A fresh id per upload: a retried expense never overwrites a stored receipt. */
export function receiptStoragePath(projectId: string, receiptId: string): string {
  if (!isUuid(projectId) || !isUuid(receiptId)) throw new Error('receiptStoragePath needs two uuids');
  return `${projectId}/receipts/${receiptId}.jpg`;
}

/** True only for a receipt path of THIS project (a browser could send any path). */
export function isReceiptPathOf(projectId: string, path: string): boolean {
  const m = /^([0-9a-f-]{36})\/receipts\/([0-9a-f-]{36})\.jpg$/.exec(path);
  return m !== null && m[1] === projectId && isUuid(m[1]) && isUuid(m[2]);
}
