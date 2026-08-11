import { encode } from 'blurhash';

/** Encode a small blurhash from an image File (client-side placeholder). */
export async function encodeBlurhash(file: File): Promise<string | null> {
  if (!file.type.startsWith('image/')) return null;

  const bitmap = await createImageBitmap(file);
  const max = 32;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  bitmap.close();
  return encode(imageData.data, w, h, 4, 3);
}
