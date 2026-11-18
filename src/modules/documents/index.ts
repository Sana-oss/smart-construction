// Public API of the documents module. Other code imports ONLY from "@/modules/documents".
// Owns tables: documents, photos (architecture §4.3), and the files under "<project id>/photos/" and
// "<project id>/documents/" in the private bucket "project-files" (migration 0013).

// Domain (pure)
export { groupPhotosByPhase, fitWithin, PHOTO_MAX_EDGE, PHOTO_JPEG_QUALITY } from './domain/photo';

// Site photos (FR-DOC-02, design S31.1/S31.2): screens, reads, routes, text
export type { PhotoWithUrl } from './application/photos';
export { PhotoGallery } from './ui/PhotoGallery';
export { PhotoForm, type PhotoPhaseOption } from './ui/PhotoForm';
export { getProjectPhotos } from './ui/queries';
export { PHOTOS_PATH, PHOTO_NEW_PATH } from './ui/routes';
export { photosTextAr } from './ui/messages.ar';

// Project documents (FR-DOC-01, design S30.1/S30.2/S10.4)
export type { DocumentWithUrl } from './application/documents';
export { DocumentList } from './ui/DocumentList';
export { DocumentForm } from './ui/DocumentForm';
export { getProjectDocuments } from './ui/queries';
export { DOCUMENTS_PATH, DOCUMENT_NEW_PATH, documentsOfPhasePath, newDocumentPath } from './ui/routes';
export { documentsTextAr, filesCountAr } from './ui/messages.ar';
