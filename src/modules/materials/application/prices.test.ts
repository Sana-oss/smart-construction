import { describe, expect, it, vi } from 'vitest';
import type { PriceRecord } from '../domain/price';
import { addPrice, getPriceHistory, getPriceLog, removePrice, type PriceStore } from './prices';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TODAY = '2026-11-19';

const rec = (p: Partial<PriceRecord> & { id: string }): PriceRecord => ({
  material: 'حديد التسليح',
  unit: 'طن',
  priceLyd: '4000.000',
  kind: 'paid',
  supplier: null,
  recordedOn: '2026-11-09',
  expiresOn: null,
  transportLyd: null,
  note: null,
  createdAt: '2026-11-09T10:00:00Z',
  ...p,
});

function fakeStore(records: PriceRecord[] = []) {
  const store: PriceStore = {
    list: vi.fn(async () => records),
    add: vi.fn(async () => ({ status: 'done' as const })),
    remove: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

describe('addPrice (S24.3)', () => {
  it('stores the validated price with money as decimal strings', async () => {
    const store = fakeStore();
    const r = await addPrice(
      store,
      { projectId: PROJECT, material: 'أسمنت', unit: 'كيس', price: '42', kind: 'quote', expiresOn: '2026-11-30', transport: '150' },
      TODAY,
    );
    expect(r).toEqual({ ok: true, material: 'أسمنت', unit: 'كيس' });
    expect(store.add).toHaveBeenCalledWith({
      projectId: PROJECT,
      material: 'أسمنت',
      unit: 'كيس',
      priceLyd: '42.000',
      kind: 'quote',
      supplier: null,
      recordedOn: null,
      expiresOn: '2026-11-30',
      transportLyd: '150.000',
      note: null,
    });
  });

  it('never calls the database when the input is invalid', async () => {
    const store = fakeStore();
    expect((await addPrice(store, { projectId: PROJECT, material: '' }, TODAY)).ok).toBe(false);
    expect(store.add).not.toHaveBeenCalled();
  });
});

describe('removePrice', () => {
  it('answers "not found" for an id that is not an id, without calling the database', async () => {
    const store = fakeStore();
    expect(await removePrice(store, { projectId: PROJECT, id: 'x' })).toEqual({ ok: false, reason: 'not_found' });
    expect(store.remove).not.toHaveBeenCalled();
    expect(await removePrice(store, { projectId: PROJECT, id: ID })).toEqual({ ok: true });
  });
});

describe('getPriceLog and getPriceHistory (S24.1, S24.2)', () => {
  const records = [
    rec({ id: '1', priceLyd: '3850.000', recordedOn: '2026-10-20' }),
    rec({ id: '2', material: 'أسمنت', unit: 'كيس', priceLyd: '42.000', kind: 'quote', expiresOn: '2026-11-22', recordedOn: '2026-11-15' }),
    rec({ id: '3', material: 'أسمنت', unit: 'كيس', priceLyd: '40.000', kind: 'quote', expiresOn: '2026-11-10', recordedOn: '2026-11-01' }),
    rec({ id: '4' }),
  ];

  it('shows each material with its latest price and that price status, and counts quotes expiring soon', async () => {
    const log = await getPriceLog(fakeStore(records), PROJECT, TODAY);
    expect(log.materials.map((m) => [m.material, m.latest.priceLyd, m.status.kind])).toEqual([
      ['أسمنت', '42.000', 'expiring'],
      ['حديد التسليح', '4000.000', 'paid'],
    ]);
    expect(log.expiringQuotes).toBe(1);
    expect(log.knownMaterials).toEqual(['أسمنت', 'حديد التسليح']);
    expect(log.knownUnits).toEqual(['طن', 'كيس']);
  });

  it('lists one material newest first, marking an expired quote', async () => {
    const h = await getPriceHistory(fakeStore(records), PROJECT, 'أسمنت', 'كيس', TODAY);
    expect(h.map((r) => [r.id, r.status.kind])).toEqual([
      ['2', 'expiring'],
      ['3', 'expired'],
    ]);
  });
});
