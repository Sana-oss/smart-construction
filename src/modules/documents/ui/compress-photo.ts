// Image compression lives in platform (shared with finance's receipt photos); this file keeps the documents
// module's names and its Arabic file-size text.

export { compressImage as compressPhoto, type CompressedImage as CompressedPhoto, type CompressFailure } from '@/platform/images/compress-image';

/** "3.4 م.ب" / "240 ك.ب": a size the owner can read. */
export function sizeAr(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}
