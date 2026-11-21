import { describe, expect, it } from 'vitest';
import {
  addContract,
  addPayment,
  getContract,
  getContracts,
  removeContract,
  removePayment,
  type ContractRecord,
  type ContractStore,
  type NewContractRecord,
  type NewPaymentRecord,
  type PaymentRecord,
} from './contracts';

const PROJECT = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PHASE = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const C1 = 'c1c1c1c1-c1c1-4c1c-8c1c-c1c1c1c1c1c1';
const C2 = 'c2c2c2c2-c2c2-4c2c-8c2c-c2c2c2c2c2c2';

function fakeStore(initial: { contracts?: ContractRecord[]; payments?: PaymentRecord[] } = {}, failWith?: 'not_allowed') {
  const added: { contracts: NewContractRecord[]; payments: NewPaymentRecord[] } = { contracts: [], payments: [] };
  const removed: string[] = [];
  const store: ContractStore = {
    async listContracts() {
      return initial.contracts ?? [];
    },
    async listPayments() {
      return initial.payments ?? [];
    },
    async addContract(c) {
      if (failWith) return { status: 'failed', reason: failWith };
      added.contracts.push(c);
      return { status: 'done', id: C1 };
    },
    async addPayment(p) {
      if (failWith) return { status: 'failed', reason: failWith };
      added.payments.push(p);
      return { status: 'done' };
    },
    async removeContract(_p, id) {
      removed.push(`contract:${id}`);
      return { status: 'done' };
    },
    async removePayment(_p, id) {
      removed.push(`payment:${id}`);
      return { status: 'done' };
    },
  };
  return { store, added, removed };
}

const contract = (id: string, valueLyd: string, title = 'عقد'): ContractRecord => ({
  id, title, contractor: 'مقاول', valueLyd, scope: null, cleanupClause: null, documentId: null, createdAt: '2026-11-21T10:00:00Z',
});
const payment = (id: string, contractId: string, amountLyd: string, paidOn: string | null = null): PaymentRecord => ({
  id, contractId, title: 'دفعة', amountLyd, retainedLyd: '0.000', phaseId: null, paidOn, createdAt: '2026-11-21T10:00:00Z',
});

describe('addContract', () => {
  it('stores the cleaned contract with the value as a decimal string and returns its id', async () => {
    const { store, added } = fakeStore();
    const r = await addContract(store, { projectId: PROJECT.toUpperCase(), title: ' عقد  الهيكل ', contractor: 'شركة البناء', value: '90,000' });
    expect(r).toEqual({ ok: true, id: C1 });
    expect(added.contracts).toEqual([
      { projectId: PROJECT, title: 'عقد الهيكل', contractor: 'شركة البناء', valueLyd: '90000.000', scope: null, cleanupClause: null, documentId: null },
    ]);
  });

  it('saves nothing when a field is wrong', async () => {
    const { store, added } = fakeStore();
    const r = await addContract(store, { projectId: PROJECT, title: '', contractor: '', value: '0' });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.kind).toBe('invalid');
    expect(added.contracts).toEqual([]);
  });

  it('refuses a project id that is not a uuid, and reports a store failure', async () => {
    const { store } = fakeStore();
    expect(await addContract(store, { projectId: 'x', title: 'عقد', contractor: 'مقاول', value: '1' })).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
    const failing = fakeStore({}, 'not_allowed');
    expect(await addContract(failing.store, { projectId: PROJECT, title: 'عقد', contractor: 'مقاول', value: '1' })).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
  });
});

describe('addPayment', () => {
  it('stores the installment with the retained part the owner typed', async () => {
    const { store, added } = fakeStore();
    const r = await addPayment(store, { projectId: PROJECT, contractId: C1, title: 'الدفعة الأولى', amount: '30,000', retained: '3,000', phaseId: PHASE });
    expect(r).toEqual({ ok: true });
    expect(added.payments).toEqual([
      { projectId: PROJECT, contractId: C1, title: 'الدفعة الأولى', amountLyd: '30000.000', retainedLyd: '3000.000', phaseId: PHASE },
    ]);
  });

  it('stores zero retained when the owner left it empty', async () => {
    const { store, added } = fakeStore();
    await addPayment(store, { projectId: PROJECT, contractId: C1, title: 'الدفعة الأولى', amount: '100' });
    expect(added.payments[0].retainedLyd).toBe('0.000');
  });

  it('refuses a retained part above the amount and a contract id that is not a uuid', async () => {
    const { store, added } = fakeStore();
    const over = await addPayment(store, { projectId: PROJECT, contractId: C1, title: 'دفعة', amount: '100', retained: '101' });
    expect(over.ok === false && over.kind === 'invalid' && over.errors).toEqual([{ field: 'retained', code: 'retained_exceeds_amount' }]);
    expect(await addPayment(store, { projectId: PROJECT, contractId: 'x', title: 'دفعة', amount: '1' })).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(added.payments).toEqual([]);
  });
});

describe('removing', () => {
  it('passes lowercase ids to the store and refuses ids that are not uuids', async () => {
    const { store, removed } = fakeStore();
    expect(await removeContract(store, { projectId: PROJECT, id: C2.toUpperCase() })).toEqual({ ok: true });
    expect(await removePayment(store, { projectId: PROJECT, id: C1 })).toEqual({ ok: true });
    expect(removed).toEqual([`contract:${C2}`, `payment:${C1}`]);
    expect(await removeContract(store, { projectId: PROJECT, id: 'x' })).toEqual({ ok: false, reason: 'not_found' });
    expect(await removePayment(store, { projectId: 'x', id: C1 })).toEqual({ ok: false, reason: 'not_found' });
  });
});

describe('getContracts / getContract', () => {
  const initial = {
    contracts: [contract(C1, '90000', 'عقد الهيكل'), contract(C2, '45000', 'عقد الأساسات')],
    payments: [payment('p1', C1, '30000', '2026-11-01'), payment('p2', C1, '15000'), payment('p3', C2, '45000', '2026-10-01')],
  };

  it('gives every contract its figures and the total value', async () => {
    const { store } = fakeStore(initial);
    const view = await getContracts(store, PROJECT);
    expect(view.totalValue.toFixed(3)).toBe('135000.000');
    const [first, second] = view.contracts;
    expect([first.paymentCount, first.summary.paid.toFixed(3), first.summary.remaining.toFixed(3)]).toEqual([2, '30000.000', '60000.000']);
    expect([second.paymentCount, second.summary.paid.toFixed(3), second.summary.remaining.toFixed(3)]).toEqual([1, '45000.000', '0.000']);
  });

  it('gives one contract with only its own schedule', async () => {
    const { store } = fakeStore(initial);
    const detail = await getContract(store, PROJECT, C1.toUpperCase());
    expect(detail?.contract.title).toBe('عقد الهيكل');
    expect(detail?.payments.map((p) => p.id)).toEqual(['p1', 'p2']);
  });

  it('returns null for a contract that is not there or an id that is not a uuid', async () => {
    const { store } = fakeStore(initial);
    expect(await getContract(store, PROJECT, 'd3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3')).toBeNull();
    expect(await getContract(store, PROJECT, 'x')).toBeNull();
  });
});
