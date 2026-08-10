export function goalProgressRatio(savedMinor: number, targetMinor: number): number {
  if (targetMinor <= 0) return 0;
  return Math.max(0, savedMinor / targetMinor);
}

export function remainingMinor(targetMinor: number, savedMinor: number): number {
  return Math.max(0, targetMinor - savedMinor);
}
