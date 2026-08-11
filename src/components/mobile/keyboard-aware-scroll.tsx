'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Keeps focused inputs visible when the on-screen keyboard opens. */
export function KeyboardAwareScroll({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root || !window.visualViewport) return;

    const onResize = () => {
      const active = document.activeElement;
      if (!(active instanceof HTMLElement)) return;
      if (!root.contains(active)) return;
      active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };

    window.visualViewport.addEventListener('resize', onResize);
    return () => window.visualViewport?.removeEventListener('resize', onResize);
  }, []);

  return <div ref={ref}>{children}</div>;
}
