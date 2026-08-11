'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function useScrollDirection(threshold = 12): 'up' | 'down' | null {
  const lastY = useRef(0);
  const [direction, setDirection] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      const delta = y - lastY.current;
      if (Math.abs(delta) < threshold) return;
      setDirection(delta > 0 ? 'down' : 'up');
      lastY.current = y;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  return direction;
}

export function ScrollHide({ children, hidden }: { children: ReactNode; hidden: boolean }) {
  return (
    <div
      className="transition-transform duration-300 ease-out"
      style={{ transform: hidden ? 'translateY(calc(100% + 1rem))' : 'translateY(0)' }}
    >
      {children}
    </div>
  );
}
