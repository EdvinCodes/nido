'use client';

import { useEffect, useState } from 'react';
import { easeOutCubicPermille, interpolateMinor } from './count-up';

const DEFAULT_DURATION_MS = 700;

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useCountUpMinor(
  target: bigint,
  enabled: boolean,
  durationMs = DEFAULT_DURATION_MS,
): bigint {
  const [current, setCurrent] = useState(0n);
  const [done, setDone] = useState(() => !enabled);

  useEffect(() => {
    if (!enabled || done) return;

    let frame = 0;

    if (prefersReducedMotion()) {
      frame = window.requestAnimationFrame(() => {
        setDone(true);
      });
      return () => {
        window.cancelAnimationFrame(frame);
      };
    }

    const started = performance.now();
    const tick = (now: number) => {
      const progress = easeOutCubicPermille(now - started, durationMs);
      setCurrent(interpolateMinor(0n, target, progress));
      if (progress < 1000) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setDone(true);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [done, durationMs, enabled, target]);

  if (!enabled || done) return target;
  return current;
}
