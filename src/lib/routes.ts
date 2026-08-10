import type { Route } from 'next';

/** Cast dynamic app paths for Next.js typed routes. */
export function route(path: string): Route {
  // Typed routes cannot express runtime-built paths; callers still pass app-local URLs only.
  return path as unknown as Route;
}
