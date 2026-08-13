'use client';

import { useEffect } from 'react';

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function isInternalLink(anchor: HTMLAnchorElement): boolean {
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  const href = anchor.getAttribute('href');
  if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return false;
  }
  const url = new URL(anchor.href, window.location.href);
  return url.origin === window.location.origin;
}

/**
 * Crossfade between App Router navigations when the View Transitions API exists.
 * Disabled under prefers-reduced-motion.
 */
export function ViewTransitions() {
  useEffect(() => {
    if (typeof document.startViewTransition !== 'function') return;

    const onClick = (event: MouseEvent) => {
      if (prefersReducedMotion()) return;
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest('a');
      if (!anchor || !isInternalLink(anchor)) return;

      document.startViewTransition(() => {
        return new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      });
    };

    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('click', onClick, true);
    };
  }, []);

  return null;
}
