/** Object name inside the private `receipts` bucket. */
export function receiptObjectPath(spaceId: string, ext: string, now = new Date()): string {
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const id = crypto.randomUUID();
  const cleanExt = ext.replace(/^\./, '').toLowerCase() || 'webp';
  return `${spaceId}/${yyyy}/${mm}/${id}.${cleanExt}`;
}

export function thumbObjectPath(storagePath: string): string {
  const dot = storagePath.lastIndexOf('.');
  if (dot < 0) return `${storagePath}-thumb.webp`;
  return `${storagePath.slice(0, dot)}-thumb.webp`;
}
