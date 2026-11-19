// Stored images (site photos, receipt photos): the rules every module shares. Pure: no browser, no database.
// The numbers are PRODUCT choices (how big a stored image is; plan of 18 Nov 2026), not engineering values.

/** Longest side of a stored image, in pixels. Sharp on a phone and a laptop, a few hundred KB as JPEG. */
export const IMAGE_MAX_EDGE = 1600;
/** JPEG quality used when re-encoding (0–1). */
export const IMAGE_JPEG_QUALITY = 0.8;
/** Every stored image is a JPEG, whatever was picked (HEIC, PNG, WebP are converted in the browser). */
export const IMAGE_STORED_TYPE = 'image/jpeg';
/** Largest image the owner may pick before compression (a phone's original photo). */
export const IMAGE_MAX_INPUT_BYTES = 30 * 1024 * 1024;
/** Largest stored image after compression. */
export const IMAGE_MAX_STORED_BYTES = 5 * 1024 * 1024;

/**
 * The size to draw an image at: scaled down so its longest side is at most `maxEdge`, keeping its proportions.
 * Never scaled UP (a small image stays as it is).
 */
export function fitWithin(width: number, height: number, maxEdge: number = IMAGE_MAX_EDGE): { width: number; height: number } {
  if (!(width > 0 && height > 0)) throw new Error('fitWithin needs a positive width and height');
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const scale = maxEdge / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** HEIC/HEIF (iPhone photos). Some browsers report an empty type for them, so the name is checked too. */
export function isHeicFile(file: { type: string; name: string }): boolean {
  return /^image\/hei[cf](-sequence)?$/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

/** An image the owner may pick: an image (HEIC included), not bigger than IMAGE_MAX_INPUT_BYTES. */
export function checkPickedImage(file: { size: number; type: string; name: string }): 'not_an_image' | 'too_large' | null {
  const looksLikeImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
  if (!looksLikeImage) return 'not_an_image';
  if (file.size > IMAGE_MAX_INPUT_BYTES) return 'too_large';
  return null;
}
