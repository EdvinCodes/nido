'use client';

import { useCallback, useRef, useState, type ReactNode, type RefObject } from 'react';
import { cn } from '@/lib/utils';

export function PullToRefresh({
  onRefresh,
  children,
  className,
  scrollRef,
}: {
  onRefresh: () => Promise<void> | void;
  children: ReactNode;
  className?: string;
  /** When set, pull only starts if this container is scrolled to the top (ledger list). */
  scrollRef?: RefObject<HTMLElement | null>;
}) {
  const startY = useRef(0);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const atTop = useCallback(() => {
    if (scrollRef?.current) return scrollRef.current.scrollTop <= 0;
    return window.scrollY <= 0;
  }, [scrollRef]);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (atTop()) {
        startY.current = e.touches[0]?.clientY ?? 0;
      }
    },
    [atTop],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY.current <= 0 || refreshing) return;
      const dy = (e.touches[0]?.clientY ?? 0) - startY.current;
      if (dy > 0 && atTop()) {
        setPull(Math.min(dy * 0.45, 72));
      }
    },
    [atTop, refreshing],
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
        <span className="mt-2 text-xs text-muted-foreground">
          {refreshing ? '…' : pull >= 56 ? '↓' : '↑'}
        </span>
      </div>
      <div style={{ transform: pull ? `translateY(${String(pull)}px)` : undefined }}>
        {children}
      </div>
    </div>
  );
}
