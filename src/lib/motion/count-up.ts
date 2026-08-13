/** Integer interpolation of minor units. Progress is 0–1000 to avoid float money. */
export function interpolateMinor(from: bigint, to: bigint, progressPermille: number): bigint {
  const clamped = Math.min(1000, Math.max(0, Math.round(progressPermille)));
  return from + ((to - from) * BigInt(clamped)) / 1000n;
}

export function easeOutCubicPermille(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1000;
  const t = Math.min(1, Math.max(0, elapsedMs / durationMs));
  const eased = 1 - (1 - t) ** 3;
  return Math.round(eased * 1000);
}
