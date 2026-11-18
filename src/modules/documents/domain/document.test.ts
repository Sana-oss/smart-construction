import { describe, expect, it } from 'vitest';
import { DOCUMENT_MAX_BYTES, documentStoragePath, isDocumentPathOf, planPickedDocument, validateDocumentDetails } from './document';

const P = '11111111-1111-4111-8111-111111111111';
const Q = '22222222-2222-4222-8222-222222222222';
const D = '33333333-3333-4333-8333-333333333333';

describe('storage paths', () => {
  it("puts a document under its project's folder with the extension of its type", () => {
    expect(documentStoragePath(P, D, 'application/pdf')).toBe(`${P}/documents/${D}.pdf`);
    expect(documentStoragePath(P, D, 'image/png')).toBe(`${P}/documents/${D}.png`);
  });

  it('accepts only a path of the same project whose extension matches the type', () => {
    expect(isDocumentPathOf(P, `${P}/documents/${D}.pdf`, 'application/pdf')).toBe(true);
    expect(isDocumentPathOf(P, `${P}/documents/${D}.pdf`, 'image/jpeg')).toBe(false);
    expect(isDocumentPathOf(P, `${Q}/documents/${D}.pdf`, 'application/pdf')).toBe(false);
    expect(isDocumentPathOf(P, `${P}/photos/${D}.jpg`, 'image/jpeg')).toBe(false);
  });
});

describe('planPickedDocument (FR-DOC-01: type and size are checked)', () => {
  it('keeps PDF, JPEG and PNG as they are', () => {
    expect(planPickedDocument({ size: 1000, type: 'application/pdf', name: 'plan.pdf' })).toEqual({ kind: 'as_is', type: 'application/pdf' });
    expect(planPickedDocument({ size: 1000, type: 'image/png', name: 'scan.png' })).toEqual({ kind: 'as_is', type: 'image/png' });
    expect(planPickedDocument({ size: 1000, type: '', name: 'PLAN.PDF' })).toEqual({ kind: 'as_is', type: 'application/pdf' });
  });

  it('converts an iPhone HEIC or a WebP to JPEG', () => {
    expect(planPickedDocument({ size: 1000, type: 'image/heic', name: 'IMG.HEIC' })).toEqual({ kind: 'convert_to_jpeg' });
    expect(planPickedDocument({ size: 1000, type: '', name: 'scan.heic' })).toEqual({ kind: 'convert_to_jpeg' });
    expect(planPickedDocument({ size: 1000, type: 'image/webp', name: 'a.webp' })).toEqual({ kind: 'convert_to_jpeg' });
  });

  it('refuses other files and files over 10 MB', () => {
    expect(planPickedDocument({ size: 1000, type: 'application/msword', name: 'a.doc' })).toEqual({ kind: 'refuse', reason: 'wrong_type' });
    expect(planPickedDocument({ size: DOCUMENT_MAX_BYTES + 1, type: 'application/pdf', name: 'big.pdf' })).toEqual({
      kind: 'refuse',
      reason: 'too_large',
    });
    expect(planPickedDocument({ size: DOCUMENT_MAX_BYTES, type: 'application/pdf', name: 'ok.pdf' }).kind).toBe('as_is');
  });
});

describe('validateDocumentDetails (S30.2)', () => {
  it('accepts a name and a kind; phase and version are optional', () => {
    expect(validateDocumentDetails({ title: '  مخطط السقف  المعتمد ', kind: 'plan', version: ' 03 ' })).toEqual({
      ok: true,
      value: { title: 'مخطط السقف المعتمد', kind: 'plan', phaseId: null, version: '03' },
    });
  });

  it('requires a name of 2–120 characters and a known kind', () => {
    const r = validateDocumentDetails({ title: '', kind: '' });
    expect(r).toEqual({
      ok: false,
      errors: [
        { field: 'title', code: 'required' },
        { field: 'kind', code: 'required' },
      ],
    });
    expect(validateDocumentDetails({ title: 'عقد', kind: 'receipt' })).toEqual({ ok: false, errors: [{ field: 'kind', code: 'unknown_choice' }] });
    expect(validateDocumentDetails({ title: 'ب'.repeat(121), kind: 'plan' }).ok).toBe(false);
  });

  it('refuses a wrong phase id and a version over 20 characters', () => {
    const r = validateDocumentDetails({ title: 'عقد المقاول', kind: 'contract', phaseId: 'x', version: '1'.repeat(21) });
    expect(r).toEqual({
      ok: false,
      errors: [
        { field: 'phaseId', code: 'invalid_id' },
        { field: 'version', code: 'too_long' },
      ],
    });
  });
});
