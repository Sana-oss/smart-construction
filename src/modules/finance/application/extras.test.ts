import { describe, expect, it, vi } from 'vitest';
import { toExtraRecord } from '../infra/supabase-extra-store';
import { addExtra, getExtras, linkExtraToContract, removeExtra, setExtraStatus, type ExtraRecord, type ExtraStore } from './extras';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
const TODAY = '2026-11-20';

const rec = (p: Partial<ExtraRecord> & { id: string }): ExtraRecord => ({
  title: 'عمل',
  costLyd: '1000.000',
  status: 'proposed',
  occurredOn: '2026-11-10',
  phaseId: null,
  contractId: null,
  note: null,
  createdAt: '2026-11-10T10:00:00Z',
  ...p,
});

function fakeStore(records: ExtraRecord[] = []) {
  const store: ExtraStore = {
    list: vi.fn(async () => records),
    add: vi.fn(async () => ({ status: 'done' as const })),
    setStatus: vi.fn(async () => ({ status: 'done' as const })),
    setContract: vi.fn(async () => ({ status: 'done' as const })),
    remove: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

describe('addExtra', () => {
  it('stores a proposed work with the cost as a decimal string', async () => {
    const store = fakeStore();
    expect(await addExtra(store, { projectId: PROJECT, title: 'توسيع الشرفة', cost: '12,500' }, TODAY)).toEqual({ ok: true });
    expect(store.add).toHaveBeenCalledWith({
      projectId: PROJECT,
      title: 'توسيع الشرفة',
      costLyd: '12500.000',
      status: 'proposed',
      occurredOn: null,
      phaseId: null,
      contractId: null,
      note: null,
    });
  });
  it('never calls the database when invalid', async () => {
    const store = fakeStore();
    expect((await addExtra(store, { projectId: PROJECT, title: '' }, TODAY)).ok).toBe(false);
    expect(store.add).not.toHaveBeenCalled();
  });
});

describe('setExtraStatus and removeExtra', () => {
  it('approves a work', async () => {
    const store = fakeStore();
    expect(await setExtraStatus(store, { projectId: PROJECT, id: ID, status: 'approved' })).toEqual({ ok: true });
    expect(store.setStatus).toHaveBeenCalledWith(PROJECT, ID, 'approved');
  });
  it('refuses an unknown status or id without calling the database', async () => {
    const store = fakeStore();
    expect(await setExtraStatus(store, { projectId: PROJECT, id: ID, status: 'paid' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await removeExtra(store, { projectId: PROJECT, id: 'x' })).toEqual({ ok: false, reason: 'not_found' });
    expect(store.setStatus).not.toHaveBeenCalled();
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe('getExtras', () => {
  it('lists newest first and takes approved works from the contingency (5% of 450,000 = 22,500)', async () => {
    const store = fakeStore([
      rec({ id: '1', status: 'approved', costLyd: '20000.000', occurredOn: '2026-11-01' }),
      rec({ id: '2', status: 'approved', costLyd: '5000.000', occurredOn: '2026-11-15' }),
      rec({ id: '3', status: 'proposed', costLyd: '3000.000', occurredOn: '2026-11-18' }),
    ]);
    const v = await getExtras(store, { id: PROJECT, totalBudgetLyd: '450000.000', contingencyPct: '5' });
    expect(v.extras.map((e) => e.id)).toEqual(['3', '2', '1']);
    expect([v.use.approved.toFixed(3), v.use.contingencyLeft.toFixed(3), v.use.beyondContingency.toFixed(3), v.use.usedUp]).toEqual([
      '25000.000',
      '0.000',
      '2500.000',
      true,
    ]);
    expect(v.use.expectedTotal.toFixed(3)).toBe('452500.000');
  });
});

describe('toExtraRecord', () => {
  it('leaves out a row with an unknown status', () => {
    const row = { id: 'x', title: 'عمل', cost_lyd: '1.000', status: 'paid', occurred_on: TODAY, phase_id: null, contract_id: null, note: null, created_at: '' };
    expect(toExtraRecord(row)).toBeNull();
    expect(toExtraRecord({ ...row, status: 'rejected' })?.status).toBe('rejected');
  });
});

describe('linkExtraToContract (3.16)', () => {
  const CONTRACT = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';

  it('links a work to a contract, with lowercase ids', async () => {
    const store = fakeStore();
    expect(await linkExtraToContract(store, { projectId: PROJECT, id: ID.toUpperCase(), contractId: CONTRACT.toUpperCase() })).toEqual({ ok: true });
    expect(store.setContract).toHaveBeenCalledWith(PROJECT, ID, CONTRACT);
  });

  it('unlinks it when the contract is empty', async () => {
    const store = fakeStore();
    expect(await linkExtraToContract(store, { projectId: PROJECT, id: ID, contractId: '' })).toEqual({ ok: true });
    expect(store.setContract).toHaveBeenCalledWith(PROJECT, ID, null);
  });

  it('never calls the database for a contract that is not an id', async () => {
    const store = fakeStore();
    expect(await linkExtraToContract(store, { projectId: PROJECT, id: ID, contractId: 'x' })).toEqual({ ok: false, reason: 'not_found' });
    expect(store.setContract).not.toHaveBeenCalled();
  });

  it('reports a failure of the database', async () => {
    const store = fakeStore();
    store.setContract = vi.fn(async () => ({ status: 'failed' as const, reason: 'unknown_reference' as const }));
    expect(await linkExtraToContract(store, { projectId: PROJECT, id: ID, contractId: CONTRACT })).toEqual({ ok: false, reason: 'unknown_reference' });
  });
});
