import { isUuid, toDb } from '@/shared-kernel';
import {
  latestPrices,
  priceHistory,
  quoteStatus,
  validatePrice,
  type MaterialPrices,
  type PriceError,
  type PriceInput,
  type PriceKind,
  type PriceRecord,
  type QuoteStatus,
} from '../domain/price';

// Use cases: the owner's price log and quotes (design S24.1, S24.2, S24.3; FR-MAT-08, FR-MAT-10). Run on the server as
// the signed-in user, under RLS. The database audits every change and deletion (0018).

export interface NewPriceRecord {
  projectId: string;
  material: string;
  unit: string;
  priceLyd: string;
  kind: PriceKind;
  supplier: string | null;
  recordedOn: string | null;
  expiresOn: string | null;
  transportLyd: string | null;
  note: string | null;
}

export type PriceFailure =
  | 'not_allowed' // not signed in, or no write access to this project
  | 'rejected' // the database refused the values (its own check of the domain rules)
  | 'not_found' // not in this project, or not visible to this user (RLS hides both)
  | 'unavailable';

export type PriceOutcome = { status: 'done' } | { status: 'failed'; reason: PriceFailure };

/** Port. The Supabase adapter is infra/supabase-price-store.ts; tests use a fake. */
export interface PriceStore {
  /** All the project's prices. ALL of them, or throw (a partial log would hide a newer price). */
  list(projectId: string): Promise<PriceRecord[]>;
  add(price: NewPriceRecord): Promise<PriceOutcome>;
  remove(projectId: string, id: string): Promise<PriceOutcome>;
}

export type AddPriceResult =
  | { ok: true; material: string; unit: string }
  | { ok: false; kind: 'invalid'; errors: PriceError[] }
  | { ok: false; kind: 'failed'; reason: PriceFailure };

/** @param today the date in Libya, "YYYY-MM-DD". */
export async function addPrice(store: PriceStore, command: PriceInput & { projectId: string }, today: string): Promise<AddPriceResult> {
  if (!isUuid(command.projectId)) return { ok: false, kind: 'failed', reason: 'not_allowed' };
  const valid = validatePrice(command, today);
  if (!valid.ok) return { ok: false, kind: 'invalid', errors: valid.errors };
  const v = valid.value;
  const outcome = await store.add({
    projectId: command.projectId.toLowerCase(),
    material: v.material,
    unit: v.unit,
    priceLyd: toDb(v.priceLyd),
    kind: v.kind,
    supplier: v.supplier,
    recordedOn: v.recordedOn,
    expiresOn: v.expiresOn,
    transportLyd: v.transportLyd ? toDb(v.transportLyd) : null,
    note: v.note,
  });
  return outcome.status === 'done' ? { ok: true, material: v.material, unit: v.unit } : { ok: false, kind: 'failed', reason: outcome.reason };
}

export async function removePrice(store: PriceStore, command: { projectId: string; id: string }): Promise<{ ok: true } | { ok: false; reason: PriceFailure }> {
  if (!isUuid(command.projectId) || !isUuid(command.id)) return { ok: false, reason: 'not_found' };
  const outcome = await store.remove(command.projectId.toLowerCase(), command.id.toLowerCase());
  return outcome.status === 'done' ? { ok: true } : { ok: false, reason: outcome.reason };
}

export type PriceWithStatus = PriceRecord & { status: QuoteStatus };

export interface PriceLog {
  materials: (MaterialPrices & { status: QuoteStatus })[];
  /** FR-MAT-10: quotes (latest or not) that expire within 7 days. */
  expiringQuotes: number;
  /** Material and unit names already used, for the form's suggestions (so the owner types the same name again). */
  knownMaterials: string[];
  knownUnits: string[];
}

/** S24.1 */
export async function getPriceLog(store: PriceStore, projectId: string, today: string): Promise<PriceLog> {
  const records = await store.list(projectId);
  return {
    materials: latestPrices(records).map((g) => ({ ...g, status: quoteStatus(g.latest, today) })),
    expiringQuotes: records.filter((r) => quoteStatus(r, today).kind === 'expiring').length,
    knownMaterials: [...new Set(records.map((r) => r.material))].sort(),
    knownUnits: [...new Set(records.map((r) => r.unit))].sort(),
  };
}

/** S24.2: one material and unit, newest first. Empty when nothing matches. */
export async function getPriceHistory(store: PriceStore, projectId: string, material: string, unit: string, today: string): Promise<PriceWithStatus[]> {
  const records = await store.list(projectId);
  return priceHistory(records, material, unit).map((r) => ({ ...r, status: quoteStatus(r, today) }));
}
