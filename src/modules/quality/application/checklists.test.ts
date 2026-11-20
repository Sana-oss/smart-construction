import { describe, expect, it } from 'vitest';
import type { CheckValue } from '../domain/checklist';
import {
  createChecklist,
  getChecklistCounts,
  getChecklistDetail,
  getPhaseChecklists,
  recordCheck,
  type ChecklistItemRecord,
  type ChecklistRecord,
  type ChecklistStore,
  type TemplateRecord,
} from './checklists';

const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const OTHER_PHASE = '8a2d1e3f-6c9b-4d4e-8f70-2b3c4d5e6f70';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const TEMPLATE: TemplateRecord = { id: id(1), title: 'فحص ما قبل الصب', itemCount: 3, status: 'unreviewed', source: 'S26.1' };

/** A fake database that copies the template like create_checklist and completes a list like the 0025 trigger. */
function fakeStore() {
  const lists: ChecklistRecord[] = [];
  const items: ChecklistItemRecord[] = [];
  let n = 100;
  const store: ChecklistStore = {
    listTemplates: async () => [TEMPLATE],
    listChecklists: async () => lists.map((l) => ({ ...l })),
    listItems: async () => items.map((i) => ({ ...i })),
    async createChecklist(c) {
      const listId = id(++n);
      lists.push({ id: listId, phaseId: c.phaseId, title: c.title, status: 'open', templateStatus: TEMPLATE.status, createdAt: `2026-11-20T10:00:${String(n).slice(-2)}Z` });
      for (const [i, text] of ['مراجعة المخطط المعتمد', 'فحص الشدة والدعامات', 'فحص التسليح'].entries()) {
        items.push({ id: id(++n), checklistId: listId, position: i + 1, text, requiresPhoto: false, result: null, note: null, responsible: null, recheckOn: null, checkedAt: null });
      }
      return { status: 'done', id: listId };
    },
    async recordCheck(itemId, check: CheckValue) {
      const item = items.find((i) => i.id === itemId);
      if (!item) return { status: 'failed', reason: 'not_found' };
      Object.assign(item, check, { checkedAt: '2026-11-20T11:00:00Z' });
      const list = lists.find((l) => l.id === item.checklistId)!;
      if (items.filter((i) => i.checklistId === list.id).every((i) => i.result !== null)) list.status = 'completed';
      return { status: 'done' };
    },
  };
  return { store, items };
}

describe('checklists of a phase (FR-QLT-02)', () => {
  it('creates named checklists for a phase, newest first, each with its own copy of the items', async () => {
    const { store } = fakeStore();
    const a = await createChecklist(store, PROJECT, [PHASE], { title: 'صب سقف الدور الأرضي', phaseId: PHASE, templateId: TEMPLATE.id });
    const b = await createChecklist(store, PROJECT, [PHASE], { title: 'صب سقف الدور الأول', phaseId: PHASE, templateId: TEMPLATE.id });
    expect(a.ok && b.ok).toBe(true);
    const lists = await getPhaseChecklists(store, PROJECT, PHASE);
    expect(lists.map((l) => l.checklist.title)).toEqual(['صب سقف الدور الأول', 'صب سقف الدور الأرضي']);
    expect(lists[0].progress).toEqual({ total: 3, checked: 0, issues: 0, unchecked: 3, complete: false });
    expect(await getPhaseChecklists(store, PROJECT, OTHER_PHASE)).toEqual([]);
  });

  it('refuses a phase of another project and an unknown template', async () => {
    const { store } = fakeStore();
    const r = await createChecklist(store, PROJECT, [PHASE], { title: 'صبة', phaseId: OTHER_PHASE, templateId: id(9) });
    expect(r.ok ? [] : r.kind === 'invalid' && r.errors).toEqual([
      { field: 'phaseId', code: 'invalid_reference' },
      { field: 'templateId', code: 'invalid_reference' },
    ]);
  });

  it('counts checklists per phase for the phase page', async () => {
    const { store } = fakeStore();
    await createChecklist(store, PROJECT, [PHASE], { title: 'صبة أولى', phaseId: PHASE, templateId: TEMPLATE.id });
    expect(await getChecklistCounts(store, PROJECT)).toEqual({ [PHASE]: { count: 1, open: 1 } });
  });
});

describe('recording checks (FR-QLT-01, design S26.2)', () => {
  it('records each item; the last result completes the checklist, problems included', async () => {
    const { store } = fakeStore();
    const c = await createChecklist(store, PROJECT, [PHASE], { title: 'صبة', phaseId: PHASE, templateId: TEMPLATE.id });
    const listId = c.ok ? c.id : '';
    const [first, second, third] = (await getChecklistDetail(store, PROJECT, listId))!.items;
    expect(await recordCheck(store, PROJECT, listId, first.id, { result: 'ok' })).toEqual({ ok: true });
    await recordCheck(store, PROJECT, listId, second.id, { result: 'issue', note: 'دعامة مائلة', responsible: 'مقاول الهيكل', recheckOn: '2026-11-25' });
    let detail = (await getChecklistDetail(store, PROJECT, listId))!;
    expect([detail.progress.checked, detail.progress.issues, detail.checklist.status]).toEqual([2, 1, 'open']);
    await recordCheck(store, PROJECT, listId, third.id, { result: 'na' });
    detail = (await getChecklistDetail(store, PROJECT, listId))!;
    expect([detail.progress.complete, detail.checklist.status]).toEqual([true, 'completed']);
    expect(detail.items[1]).toMatchObject({ result: 'issue', note: 'دعامة مائلة', responsible: 'مقاول الهيكل', recheckOn: '2026-11-25' });
  });

  it('refuses a wrong result and an item of another checklist', async () => {
    const { store } = fakeStore();
    const a = await createChecklist(store, PROJECT, [PHASE], { title: 'صبة أ', phaseId: PHASE, templateId: TEMPLATE.id });
    const b = await createChecklist(store, PROJECT, [PHASE], { title: 'صبة ب', phaseId: PHASE, templateId: TEMPLATE.id });
    const itemOfB = (await getChecklistDetail(store, PROJECT, b.ok ? b.id : ''))!.items[0];
    const aId = a.ok ? a.id : '';
    expect(await recordCheck(store, PROJECT, aId, itemOfB.id, { result: 'approved' })).toMatchObject({ ok: false, kind: 'invalid' });
    expect(await recordCheck(store, PROJECT, aId, itemOfB.id, { result: 'ok' })).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(await getChecklistDetail(store, PROJECT, 'not-an-id')).toBeNull();
  });
});
