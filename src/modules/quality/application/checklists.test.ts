import { describe, expect, it } from 'vitest';
import type { FileStore } from '@/platform/supabase/storage';
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
function fakeStore({ rebarNeedsPhoto = false } = {}) {
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
        const requiresPhoto = rebarNeedsPhoto && text === 'فحص التسليح';
        items.push({ id: id(++n), checklistId: listId, position: i + 1, text, requiresPhoto, result: null, note: null, responsible: null, recheckOn: null, checkedAt: null, photoPath: null });
      }
      return { status: 'done', id: listId };
    },
    async recordCheck(itemId, check: CheckValue & { photoPath: string | null }) {
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

/** A fake private bucket: files by path, with their type and size. */
function fakeFiles(stored: Record<string, { contentType: string; sizeBytes: number }> = {}) {
  const removed: string[] = [];
  const files: FileStore = {
    uploadTicket: async () => ({ token: 't' }),
    info: async (path) => stored[path] ?? null,
    signedUrls: async () => new Map(),
    remove: async (paths) => {
      removed.push(...paths);
      for (const p of paths) delete stored[p];
    },
  };
  return { files, removed, stored };
}

describe('the item photo (FR-QLT-01, slice 2)', () => {
  const photo = (n: number) => `${PROJECT}/checklists/${id(900 + n)}.jpg`;
  const jpeg = { contentType: 'image/jpeg', sizeBytes: 200_000 };

  async function rebarItem() {
    const { store } = fakeStore({ rebarNeedsPhoto: true });
    const c = await createChecklist(store, PROJECT, [PHASE], { title: 'صبة', phaseId: PHASE, templateId: TEMPLATE.id });
    const listId = c.ok ? c.id : '';
    const item = (await getChecklistDetail(store, PROJECT, listId))!.items.find((i) => i.text === 'فحص التسليح')!;
    return { store, listId, item };
  }

  it('an item that requires a photo is not «سليم» without one; with the photo it is', async () => {
    const { store, listId, item } = await rebarItem();
    expect(item.requiresPhoto).toBe(true);
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'ok' })).toEqual({
      ok: false,
      kind: 'invalid',
      errors: [{ field: 'photo', code: 'photo_required' }],
    });
    // A problem is recorded without a photo (D2: the system never blocks recording a problem).
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'issue', note: 'نقص كانات' })).toEqual({ ok: true });

    const { files } = fakeFiles({ [photo(1)]: jpeg });
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', photoPath: photo(1) }, files)).toEqual({ ok: true });
    expect((await getChecklistDetail(store, PROJECT, listId))!.items.find((i) => i.id === item.id)).toMatchObject({ result: 'ok', photoPath: photo(1) });
  });

  it('keeps the stored photo when none is sent, and a new one replaces it (the old file is removed)', async () => {
    const { store, listId, item } = await rebarItem();
    const { files, removed } = fakeFiles({ [photo(1)]: jpeg, [photo(2)]: jpeg });
    await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', photoPath: photo(1) }, files);
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', note: 'أُعيد الفحص' })).toEqual({ ok: true });
    expect((await getChecklistDetail(store, PROJECT, listId))!.items.find((i) => i.id === item.id)!.photoPath).toBe(photo(1));
    await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', photoPath: photo(2) }, files);
    expect((await getChecklistDetail(store, PROJECT, listId))!.items.find((i) => i.id === item.id)!.photoPath).toBe(photo(2));
    expect(removed).toEqual([photo(1)]);
  });

  it('removes a new photo whenever it is not saved', async () => {
    const { store, listId, item } = await rebarItem();
    const { files, removed } = fakeFiles({ [photo(3)]: jpeg, [photo(4)]: { contentType: 'image/png', sizeBytes: 10 } });
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'maybe', photoPath: photo(3) }, files)).toMatchObject({ kind: 'invalid' });
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', photoPath: photo(4) }, files)).toEqual({ ok: false, kind: 'failed', reason: 'photo_missing' });
    expect(await recordCheck(store, PROJECT, listId, id(999), { result: 'ok', photoPath: photo(5) }, files)).toEqual({ ok: false, kind: 'failed', reason: 'not_found' });
    expect(removed).toEqual([photo(3), photo(4), photo(5)]);
  });

  it("never touches a path outside this project's checklists folder", async () => {
    const { store, listId, item } = await rebarItem();
    const { files, removed } = fakeFiles();
    const foreign = `${PROJECT}/receipts/${id(901)}.jpg`;
    expect(await recordCheck(store, PROJECT, listId, item.id, { result: 'ok', photoPath: foreign }, files)).toEqual({ ok: false, kind: 'failed', reason: 'not_allowed' });
    expect(removed).toEqual([]);
  });
});
