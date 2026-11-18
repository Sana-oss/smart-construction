import { isUuid } from '@/shared-kernel';

// Project documents (FR-DOC-01: "رفع وثيقة (مخطط، فاتورة، عقد، ضمان، تصريح، تقييم إنشائي) وربطها بالمشروع أو المرحلة؛
// التحقق من نوع الملف وحجمه؛ الوصول بروابط موقَّعة قصيرة العمر"). Design S30.1, S30.2, S10.4. Pure.

/** The kinds named by FR-DOC-01, plus "other" for anything else the owner wants to keep. */
export const DOCUMENT_KINDS = ['plan', 'invoice', 'contract', 'warranty', 'permit', 'structural_assessment', 'other'] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];
export const isDocumentKind = (v: unknown): v is DocumentKind => (DOCUMENT_KINDS as readonly unknown[]).includes(v);

/** Largest stored document (plan of 18 Nov: enough for a scanned plan as PDF). Same as the bucket limit (0013). */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Stored file types and their extension in the storage path. HEIC and other images are converted to JPEG first. */
export const DOCUMENT_TYPES = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' } as const;
export type DocumentType = keyof typeof DOCUMENT_TYPES;
export const isDocumentType = (v: unknown): v is DocumentType => typeof v === 'string' && v in DOCUMENT_TYPES;

export const DOCUMENT_TITLE_MIN = 2;
export const DOCUMENT_TITLE_MAX = 120;
export const DOCUMENT_VERSION_MAX = 20;

/** Where a project's document is stored: "<project id>/documents/<document id>.<pdf|jpg|png>". */
export function documentStoragePath(projectId: string, documentId: string, type: DocumentType): string {
  if (!isUuid(projectId) || !isUuid(documentId)) throw new Error('documentStoragePath needs two uuids');
  return `${projectId}/documents/${documentId}.${DOCUMENT_TYPES[type]}`;
}

/** True only for a document path of THIS project whose extension matches the stored type. */
export function isDocumentPathOf(projectId: string, path: string, type: DocumentType): boolean {
  const m = /^([0-9a-f-]{36})\/documents\/([0-9a-f-]{36})\.(pdf|jpg|png)$/.exec(path);
  return m !== null && m[1] === projectId && isUuid(m[1]) && isUuid(m[2]) && m[3] === DOCUMENT_TYPES[type];
}

/** How the picked file will be stored: as it is (PDF, JPEG, PNG), converted to JPEG (other images), or refused. */
export type PickedDocumentPlan =
  | { kind: 'as_is'; type: DocumentType }
  | { kind: 'convert_to_jpeg' }
  | { kind: 'refuse'; reason: 'wrong_type' | 'too_large' };

export function planPickedDocument(file: { size: number; type: string; name: string }): PickedDocumentPlan {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  const asIs: DocumentType | null =
    type === 'application/pdf' || (type === '' && name.endsWith('.pdf'))
      ? 'application/pdf'
      : type === 'image/jpeg'
        ? 'image/jpeg'
        : type === 'image/png'
          ? 'image/png'
          : null;
  if (asIs) return file.size > DOCUMENT_MAX_BYTES ? { kind: 'refuse', reason: 'too_large' } : { kind: 'as_is', type: asIs };
  // Other images (HEIC from an iPhone, WebP, ...) are converted in the browser; the result is checked again.
  if (type.startsWith('image/') || /\.(heic|heif|webp)$/.test(name)) return { kind: 'convert_to_jpeg' };
  return { kind: 'refuse', reason: 'wrong_type' };
}

export type DocumentField = 'title' | 'kind' | 'phaseId' | 'version' | 'file';
export type DocumentErrorCode = 'required' | 'too_short' | 'too_long' | 'unknown_choice' | 'invalid_id' | 'wrong_type' | 'too_large';
export interface DocumentError {
  field: DocumentField;
  code: DocumentErrorCode;
}

export interface DocumentDetails {
  title: string;
  kind: DocumentKind;
  phaseId: string | null;
  /** The design's «رقم الإصدار» (e.g. "03"), free text, optional. */
  version: string | null;
}

export type DocumentDetailsResult = { ok: true; value: DocumentDetails } | { ok: false; errors: DocumentError[] };

/** The words of the form (S30.2): name and type required; phase and version optional. */
export function validateDocumentDetails(input: {
  title?: string | null;
  kind?: string | null;
  phaseId?: string | null;
  version?: string | null;
}): DocumentDetailsResult {
  const errors: DocumentError[] = [];
  const title = (input.title ?? '').trim().replace(/\s+/g, ' ');
  if (title === '') errors.push({ field: 'title', code: 'required' });
  else if ([...title].length < DOCUMENT_TITLE_MIN) errors.push({ field: 'title', code: 'too_short' });
  else if ([...title].length > DOCUMENT_TITLE_MAX) errors.push({ field: 'title', code: 'too_long' });

  const kind = (input.kind ?? '').trim();
  if (kind === '') errors.push({ field: 'kind', code: 'required' });
  else if (!isDocumentKind(kind)) errors.push({ field: 'kind', code: 'unknown_choice' });

  const phaseId = (input.phaseId ?? '').trim() || null;
  if (phaseId !== null && !isUuid(phaseId)) errors.push({ field: 'phaseId', code: 'invalid_id' });

  const version = (input.version ?? '').trim() || null;
  if (version !== null && [...version].length > DOCUMENT_VERSION_MAX) errors.push({ field: 'version', code: 'too_long' });

  if (errors.length > 0 || !isDocumentKind(kind)) return { ok: false, errors };
  return { ok: true, value: { title, kind, phaseId, version } };
}
