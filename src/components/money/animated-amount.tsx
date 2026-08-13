'use client';

import { Amount, type AmountProps } from '@/components/money/amount';
import { useCountUpMinor } from '@/lib/motion/use-count-up-minor';

/** Dashboard figures count up on first mount only. */
export function AnimatedAmount({ minor, ...props }: AmountProps) {
  const target = minor == null ? 0n : typeof minor === 'number' ? BigInt(minor) : minor;
  const displayed = useCountUpMinor(target, minor != null);
  if (minor == null) {
    return <Amount minor={null} {...props} />;
  }
  return <Amount minor={displayed} {...props} />;
}
