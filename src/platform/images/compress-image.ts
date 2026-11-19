// Browser-only: turn a picked image into the JPEG we store (FR-DOC-02 "تُضغط قبل الرفع"; NFR-PRF-01). Used by site
// photos and documents (documents module) and receipt photos (finance module): in platform because modules of the
// same level may not import each other (rule R2).
// Scaled down to IMAGE_MAX_EDGE on its longest side and re-encoded at IMAGE_JPEG_QUALITY. Re-encoding through a
// canvas also drops the file's metadata (GPS location, camera details): a privacy gain, said on the form.
//
// HEIC (iPhone photos, decision 18 Nov 2026):
//   - Safari decodes HEIC itself, and iPhones usually hand the browser a JPEG anyway, so nothing extra happens there.
//   - Browsers that cannot read HEIC (Chrome or Firefox on Android or Windows) get the converter "heic-to"
//     (libheif in WebAssembly, LGPL-3.0), loaded ONLY at that moment: about 3 MB, never part of the normal pages.

import { fitWithin, IMAGE_JPEG_QUALITY, IMAGE_STORED_TYPE, isHeicFile } from '@/shared-kernel';

export type CompressFailure = 'unreadable' | 'heicFailed';

export interface CompressedImage {
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

export async function compressImage(
  file: File,
  onConverting: () => void = () => {},
): Promise<{ ok: true; photo: CompressedImage } | { ok: false; reason: CompressFailure }> {
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

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, IMAGE_STORED_TYPE, IMAGE_JPEG_QUALITY));
  return blob ? { ok: true, photo: { blob, width, height } } : { ok: false, reason: 'unreadable' };
}
