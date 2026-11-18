// Browser-only: turn the picked photo into the JPEG we store (FR-DOC-02 "تُضغط قبل الرفع"; NFR-PRF-01).
// Scaled down to PHOTO_MAX_EDGE on its longest side and re-encoded at PHOTO_JPEG_QUALITY. Re-encoding through a
// canvas also drops the file's metadata (GPS location, camera details): a privacy gain, said on the form.
//
// HEIC (iPhone photos, decision 18 Nov 2026):
//   - Safari decodes HEIC itself, and iPhones usually hand the browser a JPEG anyway, so nothing extra happens there.
//   - Browsers that cannot read HEIC (Chrome or Firefox on Android or Windows) get the converter "heic-to"
//     (libheif in WebAssembly, LGPL-3.0), loaded ONLY at that moment: about 3 MB, never part of the normal pages.

import { fitWithin, isHeicFile, PHOTO_JPEG_QUALITY, PHOTO_STORED_TYPE } from '../domain/photo';

export type CompressFailure = 'unreadable' | 'heicFailed';

export interface CompressedPhoto {
  blob: Blob;
  width: number;
  height: number;
}

async function decode(file: File, onConverting: () => void): Promise<ImageBitmap> {
  try {
    // 'from-image': a portrait phone photo stays upright (its EXIF orientation is applied).
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (first) {
    if (!isHeicFile(file)) throw first;
    onConverting();
    const { heicTo } = await import('heic-to/next');
    return heicTo({ blob: file, type: 'bitmap' });
  }
}

export async function compressPhoto(
  file: File,
  onConverting: () => void = () => {},
): Promise<{ ok: true; photo: CompressedPhoto } | { ok: false; reason: CompressFailure }> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file, onConverting);
  } catch {
    return { ok: false, reason: isHeicFile(file) ? 'heicFailed' : 'unreadable' };
  }

  const { width, height } = fitWithin(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return { ok: false, reason: 'unreadable' };
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, PHOTO_STORED_TYPE, PHOTO_JPEG_QUALITY));
  return blob ? { ok: true, photo: { blob, width, height } } : { ok: false, reason: 'unreadable' };
}

/** "3.4 م.ب" / "240 ك.ب": a size the owner can read. */
export function sizeAr(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  return `${Math.max(1, Math.round(bytes / 1024))} ك.ب`;
}
