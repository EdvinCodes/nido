'use client';

import { cn } from '@/lib/utils';
import { type ReactNode, useEffect, useRef, useState } from 'react';

type ScrollRevealProps = {
  children: ReactNode;
  className?: string;
  /** Stagger delay in ms when nested inside a group. */
  delayMs?: number;
};

/**
 * Fade-in on scroll via IntersectionObserver. Disabled under prefers-reduced-motion.
 * Opacity-only transitions avoid layout shift.
 */
export function ScrollReveal({ children, className, delayMs = 0 }: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
      setReduceMotion(mq.matches);
      if (mq.matches) setVisible(true);
    };
    sync();
    mq.addEventListener('change', sync);
    return () => {
      mq.removeEventListener('change', sync);
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          window.setTimeout(() => {
            setVisible(true);
          }, delayMs);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
    };
  }, [delayMs, reduceMotion]);

  return (
    <div
      ref={ref}
      className={cn(
        'transition-opacity duration-500 ease-out',
        visible || reduceMotion ? 'opacity-100' : 'opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
