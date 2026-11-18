// Routes of the documents screens.
/** Site photos grouped by phase (design S31.1). */
export const PHOTOS_PATH = '/photos';
/** Add a photo and a note (design S31.2). */
export const PHOTO_NEW_PATH = '/photos/new';
/** Project documents (design S30.1); with ?phase=<id>, one phase's documents (S10.4). */
export const DOCUMENTS_PATH = '/documents';
export const documentsOfPhasePath = (phaseId: string) => `${DOCUMENTS_PATH}?phase=${encodeURIComponent(phaseId)}`;
/** Add a document (design S30.2); with ?phase=<id>, the phase is preselected. */
export const DOCUMENT_NEW_PATH = '/documents/new';
export const newDocumentPath = (phaseId?: string | null) =>
  phaseId ? `${DOCUMENT_NEW_PATH}?phase=${encodeURIComponent(phaseId)}` : DOCUMENT_NEW_PATH;
