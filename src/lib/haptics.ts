/** Light haptic feedback where the Vibration API exists. */
export function hapticTap(pattern: number | number[] = 12): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

export function hapticSuccess(): void {
  hapticTap([10, 40, 10]);
}

export function hapticDestructive(): void {
  hapticTap([20, 60, 20, 60]);
}
