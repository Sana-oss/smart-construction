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
