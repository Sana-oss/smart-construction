import { describe, expect, it } from 'vitest';
import type { FileStore } from '@/platform/supabase/storage';
import { addIssue, changeIssueStatus, getIssue, getIssues, openIssuesOfPhase, replaceIssuePhoto, type IssueRecord, type IssueStore } from './issues';

const PROJECT = '0b9d3c1a-2e4f-4a6b-8c7d-9e0f1a2b3c4d';
const PHASE = '7f1c0d2e-5b8a-4c3d-9e6f-1a2b3c4d5e6f';
const OTHER = '8a2d1e3f-6c9b-4d4e-8f70-2b3c4d5e6f70';
const LIST = '3c2b1a09-8f7e-4d6c-9b5a-0f1e2d3c4b5a';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const photo = (n: number) => `${PROJECT}/issues/${id(900 + n)}.jpg`;
const jpeg = { contentType: 'image/jpeg', sizeBytes: 200_000 };

/** A fake database: states dated like the 0029 guard. */
function fakeStore() {
  const rows: IssueRecord[] = [];
  let n = 0;
  const store: IssueStore = {
    list: async () => rows.map((r) => ({ ...r })),
    checklistIds: async () => [LIST],
    async add(_p, issue) {
      const newId = id(++n);
      rows.push({ ...issue, id: newId, status: 'open', createdAt: `2026-11-2${n}T10:00:00Z`, startedAt: null, closedAt: null });
      return { status: 'done', id: newId };
    },
    async setStatus(_p, issueId, status) {
      const r = rows.find((x) => x.id === issueId);
      if (!r) return { status: 'failed', reason: 'not_found' };
      r.status = status;
      if (status === 'in_progress' && !r.startedAt) r.startedAt = '2026-11-21T09:00:00Z';
      r.closedAt = status === 'closed' ? '2026-11-22T09:00:00Z' : null;
      return { status: 'done' };
    },
    async setPhoto(_p, issueId, path) {
      const r = rows.find((x) => x.id === issueId);
      if (!r) return { status: 'failed', reason: 'not_found' };
      r.photoPath = path;
      return { status: 'done' };
    },
  };
  return { store };
}

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
  return { files, removed };
}

describe('the defects list (FR-QLT-06, FR-QLT-07)', () => {
  it('adds defects, lists them unresolved first, and counts what is open', async () => {
    const { store } = fakeStore();
    await addIssue(store, PROJECT, [PHASE], { title: 'شرخ في الجدار', severity: 'minor', phaseId: PHASE });
    const b = await addIssue(store, PROJECT, [PHASE], { title: 'مراجعة تسليح السقف', severity: 'critical', phaseId: PHASE, checklistId: LIST });
    await addIssue(store, PROJECT, [PHASE], { title: 'باب لا يُغلق', severity: 'major' });
    expect(b.ok).toBe(true);
    await changeIssueStatus(store, PROJECT, b.ok ? b.id : '', 'closed');

    const all = await getIssues(store, PROJECT);
    expect(all.issues.map((i) => i.title)).toEqual(['باب لا يُغلق', 'شرخ في الجدار', 'مراجعة تسليح السقف']);
    expect(all.openCount).toBe(2);
    const phase = await getIssues(store, PROJECT, PHASE);
    expect([phase.issues.length, phase.openCount]).toEqual([2, 1]);
    expect((await openIssuesOfPhase(store, PROJECT, PHASE)).map((i) => i.title)).toEqual(['شرخ في الجدار']);
  });

  it('refuses a phase or a checklist that is not the project’s, and an unknown state', async () => {
    const { store } = fakeStore();
    const r = await addIssue(store, PROJECT, [PHASE], { title: 'عيب', severity: 'minor', phaseId: OTHER, checklistId: id(5) });
    expect(r.ok ? [] : r.kind === 'invalid' && r.errors.map((e) => e.field)).toEqual(['phaseId', 'checklistId']);
    const a = await addIssue(store, PROJECT, [PHASE], { title: 'عيب', severity: 'minor' });
    expect(await changeIssueStatus(store, PROJECT, a.ok ? a.id : '', 'resolved')).toEqual({ status: 'failed', reason: 'rejected' });
  });

  it('moves through the states and may be reopened', async () => {
    const { store } = fakeStore();
    const a = await addIssue(store, PROJECT, [PHASE], { title: 'عيب', severity: 'minor' });
    const issueId = a.ok ? a.id : '';
    await changeIssueStatus(store, PROJECT, issueId, 'in_progress');
    await changeIssueStatus(store, PROJECT, issueId, 'closed');
    await changeIssueStatus(store, PROJECT, issueId, 'open');
    expect(await getIssue(store, PROJECT, issueId)).toMatchObject({ status: 'open', closedAt: null, startedAt: '2026-11-21T09:00:00Z' });
  });
});

describe('the defect photo (one, optional, replaceable)', () => {
  it('keeps a checked photo, removes one that is not saved, and never touches another folder', async () => {
    const { store } = fakeStore();
    const { files, removed } = fakeFiles({ [photo(1)]: jpeg, [photo(2)]: jpeg, [photo(3)]: { contentType: 'image/png', sizeBytes: 9 } });
    const a = await addIssue(store, PROJECT, [PHASE], { title: 'تسرب مياه', severity: 'major', photoPath: photo(1) }, files);
    expect(a.ok && (await getIssue(store, PROJECT, a.id))?.photoPath).toBe(photo(1));
    expect(await addIssue(store, PROJECT, [PHASE], { title: 'x', severity: 'minor', photoPath: photo(2) }, files)).toMatchObject({ kind: 'invalid' });
    expect(await addIssue(store, PROJECT, [PHASE], { title: 'عيب', severity: 'minor', photoPath: photo(3) }, files)).toEqual({ ok: false, kind: 'failed', reason: 'photo_missing' });
    expect(removed).toEqual([photo(2), photo(3)]);
    expect(await addIssue(store, PROJECT, [PHASE], { title: 'عيب', severity: 'minor', photoPath: `${PROJECT}/receipts/${id(1)}.jpg` }, files)).toEqual({
      ok: false,
      kind: 'failed',
      reason: 'not_allowed',
    });
  });

  it('a new photo replaces the old one, whose file is removed', async () => {
    const { store } = fakeStore();
    const { files, removed } = fakeFiles({ [photo(1)]: jpeg, [photo(4)]: jpeg });
    const a = await addIssue(store, PROJECT, [PHASE], { title: 'تسرب مياه', severity: 'major', photoPath: photo(1) }, files);
    const issueId = a.ok ? a.id : '';
    expect(await replaceIssuePhoto(store, PROJECT, issueId, photo(4), files)).toEqual({ status: 'done' });
    expect((await getIssue(store, PROJECT, issueId))?.photoPath).toBe(photo(4));
    expect(removed).toEqual([photo(1)]);
  });
});
