import imageCompression from 'browser-image-compression';

export type CompressResult = {
  file: File;
  beforeBytes: number;
  afterBytes: number;
};

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** Compress images to ≤1600px WebP @ 0.8. PDFs pass through unchanged. */
export async function compressReceipt(file: File): Promise<CompressResult> {
  const beforeBytes = file.size;
  if (file.type === 'application/pdf' || !IMAGE_TYPES.has(file.type)) {
    return { file, beforeBytes, afterBytes: beforeBytes };
  }

  const compressed = await imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    fileType: 'image/webp',
    useWebWorker: true,
    preserveExif: false,
  });

  const webp =
    compressed.type === 'image/webp'
      ? compressed
      : new File([compressed], replaceExt(file.name, 'webp'), { type: 'image/webp' });

  return {
    file:
      webp instanceof File
        ? webp
        : new File([webp], replaceExt(file.name, 'webp'), {
            type: 'image/webp',
          }),
    beforeBytes,
    afterBytes: webp.size,
  };
}

function replaceExt(name: string, ext: string): string {
  const base = name.includes('.') ? name.slice(0, name.lastIndexOf('.')) : name;
  return `${base}.${ext}`;
}

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_MAX_PER_TX = 5;
export const ATTACHMENT_ACCEPT =
  'image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf';

export function isAllowedAttachment(file: File): boolean {
  if (file.size <= 0 || file.size > ATTACHMENT_MAX_BYTES) return false;
  return (
    IMAGE_TYPES.has(file.type) ||
    file.type === 'application/pdf' ||
    /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(file.name)
  );
}
