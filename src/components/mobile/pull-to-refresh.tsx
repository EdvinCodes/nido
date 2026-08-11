'use client';

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function PullToRefresh({
  onRefresh,
  children,
  className,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
}) {
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY <= 0) {
      startY.current = e.touches[0]?.clientY ?? 0;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current <= 0 || refreshing) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy > 0 && window.scrollY <= 0) {
        setPull(Math.min(dy * 0.45, 72));
      }
    },
    [refreshing],
  );

  const onTouchEnd = useCallback(async () => {
    if (pull >= 56 && !refreshing) {
      setRefreshing(true);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }
    setPull(0);
    startY.current = 0;
  }, [onRefresh, pull, refreshing]);

  return (
    <div
      className={cn('relative', className)}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => void onTouchEnd()}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center transition-[height,opacity]"
        style={{ height: pull, opacity: pull > 8 ? 1 : 0 }}
      >
        <span
          className={cn(
            'mt-2 size-5 rounded-full border-2 border-primary border-t-transparent',
            refreshing && 'animate-spin',
          )}
        />
      </div>
      <div style={{ transform: pull ? `translateY(${pull}px)` : undefined }}>{children}</div>
    </div>
  );
}
