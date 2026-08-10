import type { Route } from 'next';

/** Narrow dynamic app paths for Next.js typed routes (callers pass app-local URLs only). */
export function route(path: string): Route {
  return path;
}
