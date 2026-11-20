import { describe, expect, it } from 'vitest';
import { addPour, getConcreteLog, getPour, markReminder, removePour, type PourRecord, type PourStore } from './concrete';

const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const TODAY = '2026-11-20';
const op = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** A fake database: one pour per clientOpId, «تمّ» stamped like 0030. */
function fakeStore() {
  const rows: (PourRecord & { clientOpId: string })[] = [];
  let n = 0;
  const store: PourStore = {
    list: async () => rows.map((r) => ({ ...r })),
    async add(_p, pour) {
      const found = rows.find((r) => r.clientOpId === pour.clientOpId);
      if (found) return { status: 'done', id: found.id };
      const id = op(100 + ++n);
      rows.push({ ...pour, id, curingDoneAt: null, formworkDoneAt: null, createdAt: `2026-11-20T10:0${n}:00Z` });
      return { status: 'done', id };
    },
    async setDone(_p, id, kind, done) {
      const r = rows.find((x) => x.id === id);
      if (!r) return { status: 'failed', reason: 'not_found' };
      const at = done ? '2026-11-20T12:00:00Z' : null;
      if (kind === 'curing') r.curingDoneAt = at;
      else r.formworkDoneAt = at;
      return { status: 'done' };
    },
    async remove(_p, id) {
      const i = rows.findIndex((x) => x.id === id);
      if (i < 0) return { status: 'failed', reason: 'not_found' };
      rows.splice(i, 1);
      return { status: 'done' };
    },
  };
  return { store, rows };
}

const pour = (over: object) => ({ element: 'سقف الدور الأرضي', pouredOn: '2026-11-12', supplier: 'الخرسانة الحديثة', qtyM3: '30', ...over });

describe('the concrete log (FR-QLT-04, design S27.1)', () => {
  it('records pours once, newest first, with the total quantity', async () => {
    const { store } = fakeStore();
    await addPour(store, PROJECT, [PHASE], pour({ element: 'صب القواعد', pouredOn: '2026-10-29', qtyM3: '30', clientOpId: op(1) }), TODAY);
    await addPour(store, PROJECT, [PHASE], pour({ element: 'صب الأعمدة', pouredOn: '2026-11-07', qtyM3: '18', phaseId: PHASE, clientOpId: op(2) }), TODAY);
    await addPour(store, PROJECT, [PHASE], pour({ element: 'صب الأعمدة', pouredOn: '2026-11-07', qtyM3: '18', phaseId: PHASE, clientOpId: op(2) }), TODAY);
    const log = await getConcreteLog(store, PROJECT, null, TODAY);
    expect(log.pours.map((p) => p.element)).toEqual(['صب الأعمدة', 'صب القواعد']);
    expect([log.totalM3.toString(), log.count]).toEqual(['48', 2]);
    expect((await getConcreteLog(store, PROJECT, PHASE, TODAY)).count).toBe(1);
  });

  it('refuses a pour without a date, a supplier or a quantity, and a phase of another project', async () => {
    const { store } = fakeStore();
    const r = await addPour(store, PROJECT, [PHASE], { element: 'قواعد', phaseId: op(9), clientOpId: op(3) }, TODAY);
    expect(r.ok ? [] : r.kind === 'invalid' && r.errors.map((e) => e.field)).toEqual(['pouredOn', 'supplier', 'qtyM3', 'phaseId']);
  });
});

describe('reminders on the engineer dates (FR-QLT-05)', () => {
  it('shows due and late reminders until marked done, and again when undone', async () => {
    const { store } = fakeStore();
    const a = await addPour(store, PROJECT, [PHASE], pour({ curingUntil: '2026-11-19', formworkOn: '2026-12-03', clientOpId: op(4) }), TODAY);
    const id = a.ok ? a.id : '';
    let log = await getConcreteLog(store, PROJECT, null, TODAY);
    expect(log.reminders.map((r) => `${r.kind}:${r.days}`)).toEqual(['curing:-1']);
    expect(await markReminder(store, PROJECT, id, 'curing', true)).toEqual({ status: 'done' });
    log = await getConcreteLog(store, PROJECT, null, TODAY);
    expect(log.reminders).toEqual([]);
    await markReminder(store, PROJECT, id, 'curing', false);
    expect((await getConcreteLog(store, PROJECT, null, TODAY)).reminders).toHaveLength(1);
    expect(await markReminder(store, PROJECT, id, 'cleaning', true)).toEqual({ status: 'failed', reason: 'rejected' });
  });
});

describe('deleting a pour', () => {
  it('removes it; an unknown id is not found', async () => {
    const { store } = fakeStore();
    const a = await addPour(store, PROJECT, [PHASE], pour({ clientOpId: op(5) }), TODAY);
    const id = a.ok ? a.id : '';
    expect(await removePour(store, PROJECT, id)).toEqual({ status: 'done' });
    expect(await getPour(store, PROJECT, id)).toBeNull();
    expect(await removePour(store, PROJECT, 'x')).toEqual({ status: 'failed', reason: 'not_found' });
  });
});
