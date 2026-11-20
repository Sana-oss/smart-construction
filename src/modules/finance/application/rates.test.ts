import { describe, expect, it, vi } from 'vitest';
import type { RateRecord } from '../domain/currency';
import { toRateRecord } from '../infra/supabase-rate-store';
import { addRate, getRateLog, removeRate, type RateStore } from './rates';

const PROJECT = '11111111-1111-4111-8111-111111111111';
const TODAY = '2026-11-20';

function fakeStore(records: RateRecord[] = []) {
  const store: RateStore = {
    list: vi.fn(async () => records),
    add: vi.fn(async () => ({ status: 'done' as const })),
    remove: vi.fn(async () => ({ status: 'done' as const })),
  };
  return store;
}

describe('addRate', () => {
  it('stores the validated rate with 4 places', async () => {
    const store = fakeStore();
    expect(await addRate(store, { projectId: PROJECT, currency: 'usd', rate: '7.25' }, TODAY)).toEqual({ ok: true });
    expect(store.add).toHaveBeenCalledWith({ projectId: PROJECT, currency: 'USD', lydPerUnit: '7.2500', rateDate: null, note: null });
  });
  it('never calls the database when invalid', async () => {
    const store = fakeStore();
    expect((await addRate(store, { projectId: PROJECT, currency: 'GBP', rate: '1' }, TODAY)).ok).toBe(false);
    expect(store.add).not.toHaveBeenCalled();
  });
});

describe('removeRate', () => {
  it('answers "not found" for an id that is not an id', async () => {
    const store = fakeStore();
    expect(await removeRate(store, { projectId: PROJECT, id: 'x' })).toEqual({ ok: false, reason: 'not_found' });
    expect(store.remove).not.toHaveBeenCalled();
  });
});

describe('getRateLog', () => {
  it('lists newest first and keeps the latest of each currency', async () => {
    const r = (id: string, currency: RateRecord['currency'], rateDate: string): RateRecord => ({
      id,
      currency,
      lydPerUnit: '1.0000',
      rateDate,
      note: null,
      createdAt: `${rateDate}T10:00:00Z`,
    });
    const log = await getRateLog(fakeStore([r('1', 'USD', '2026-11-01'), r('2', 'USD', '2026-11-15'), r('3', 'EUR', '2026-11-10')]), PROJECT);
    expect(log.rates.map((x) => x.id)).toEqual(['2', '3', '1']);
    expect([log.latest.USD?.id, log.latest.EUR?.id]).toEqual(['2', '3']);
  });
});

describe('toRateRecord', () => {
  it('keeps the rate as text and leaves out an unknown currency', () => {
    const row = { id: 'r1', currency: 'TRY', lyd_per_unit: '0.2000', rate_date: '2026-11-20', note: null, created_at: '2026-11-20T08:00:00Z' };
    expect(toRateRecord(row)?.lydPerUnit).toBe('0.2000');
    expect(toRateRecord({ ...row, currency: 'GBP' })).toBeNull();
  });
});
